/*
 * @Author: mrrs878@foxmail.com
 * @Date: 2022-02-12 15:50:22
 * @LastEditors: mrrs878@foxmail.com
 * @LastEditTime: 2022-02-17 21:46:22
 */

import { EventEmitter } from 'events';
import {
  ExtensionContext, TextDocument, window, workspace, commands,
} from 'vscode';
import { innerJoin } from 'ramda';
import debounce from 'lodash.debounce';
import {
  calculated, clearDecorations, flushDecorations,
  logger, checkRegistryStatus, getPackageVersion, initNodePath,
  filterPackages, getPackages, getPackagesFromPackageJSON,
} from './utils';

let isActive = true;

const emitters: any = {};

function language({ fileName, languageId }: any) {
  if (languageId === 'Log') {
    return '';
  }
  const configuration = workspace.getConfiguration('importVersion');
  const typescriptRegex = new RegExp(configuration.typescriptExtensions.join('|'));
  const javascriptRegex = new RegExp(configuration.javascriptExtensions.join('|'));

  if (languageId === 'typescript' || languageId === 'typescriptreact' || typescriptRegex.test(fileName)) {
    return 'typescript';
  } if (languageId === 'javascript' || languageId === 'javascriptreact' || javascriptRegex.test(fileName)) {
    return 'javascript';
  }
  return undefined;
}

function importVersion(
  fileName: string,
  text: string,
  documentLanguage: string | undefined,
  pkgs: Array<string>,
  config = { maxCallTime: Infinity, concurrent: true },
) {
  logger.log(config.toString());

  if (documentLanguage === undefined) {
    return null;
  }

  const emitter = new EventEmitter();
  setTimeout(async () => {
    try {
      const mixedPackages = getPackages(fileName, text, documentLanguage).filter(filterPackages);
      const imports = innerJoin(
        (p, name) => {
          if (p.name.startsWith('@')) {
            // eslint-disable-next-line no-param-reassign
            p.name = p.name.split('/').slice(0, 2).join('/');
          }
          return p.name === name;
        },
        mixedPackages,
        pkgs,
      );
      emitter.emit('start', imports);

      const promises = imports
        .map((packageInfo: any) => getPackageVersion(packageInfo))
        .map((promise: any) => promise.then((packageInfo: any) => {
          emitter.emit('calculated', packageInfo);
          logger.log('calculated');
          return packageInfo;
        }));
      const packages = (await Promise.all(promises)).filter((x: any) => x);
      emitter.emit('done', packages);
    } catch (e) {
      emitter.emit('error', e);
    }
  }, 0);

  return emitter;
}

async function processActiveFile(document: TextDocument) {
  if (document && language(document)) {
    const { fileName } = document;

    const { pkgs } = getPackagesFromPackageJSON(fileName);

    if (emitters[fileName]) {
      emitters[fileName].removeAllListeners();
    }
    const { timeout } = workspace.getConfiguration('importVersion');
    const emitter = importVersion(
      fileName,
      document.getText(),
      language(document),
      pkgs,
      { concurrent: true, maxCallTime: timeout },
    );
    if (!emitter) {
      return;
    }
    emitters[fileName] = emitter;
    emitters[fileName].on('error', (e: any) => logger.log(`importVersion error: ${e}`));
    emitters[fileName].on('start', (packages: any) => flushDecorations(fileName, packages));
    emitters[fileName].on('calculated', (packageInfo: any) => calculated(packageInfo));
    emitters[fileName].on('done', (packages: Array<any>) => flushDecorations(fileName, packages));
  }
}

export function deactivate() {
  // cleanup();
}

export async function activate(context: ExtensionContext) {
  try {
    logger.init(context);
    logger.log('starting...');

    initNodePath();
    await checkRegistryStatus();

    workspace.onDidChangeTextDocument(debounce(
      (ev) => isActive && processActiveFile(ev.document),
      500,
    ));
    window.onDidChangeActiveTextEditor(debounce(
      (ev) => ev && isActive && processActiveFile(ev.document),
      500,
    ));
    if (window.activeTextEditor && isActive) {
      processActiveFile(window.activeTextEditor.document);
    }

    context.subscriptions.push(commands.registerCommand('importVersion.toggle', () => {
      isActive = !isActive;
      if (isActive && window.activeTextEditor) {
        processActiveFile(window.activeTextEditor.document);
      } else {
        deactivate();
        clearDecorations();
      }
    }));
  } catch (e) {
    if ((e as any).toString) {
      window.showInformationMessage((e as any).toString());
    }
    logger.log(`wrapping error: ${e}`);
  }
}
