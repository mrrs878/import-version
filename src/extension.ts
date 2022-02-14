/*
 * @Author: mrrs878@foxmail.com
 * @Date: 2022-02-12 15:50:22
 * @LastEditors: mrrs878@foxmail.com
 * @LastEditTime: 2022-02-14 22:17:38
 */

import { EventEmitter } from 'events';
import {
  ExtensionContext, TextDocument, window, workspace, commands,
} from 'vscode';
import { calculated, clearDecorations, flushDecorations } from './utils/decorator';
import logger from './utils/logger';
import { checkRegistryStatus, getPackageVersion, initNodePath } from './utils';
import { filterPackages, getPackages } from './utils/babelParser';

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
  config = { maxCallTime: Infinity, concurrent: true },
) {
  logger.log(config.toString());

  if (documentLanguage === undefined) {
    return null;
  }

  const emitter = new EventEmitter();
  setTimeout(async () => {
    try {
      const imports = getPackages(fileName, text, documentLanguage).filter(filterPackages);
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
    if (emitters[fileName]) {
      emitters[fileName].removeAllListeners();
    }
    const { timeout } = workspace.getConfiguration('importVersion');
    const emitter = importVersion(
      fileName,
      document.getText(),
      language(document),
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

    workspace.onDidChangeTextDocument((ev) => isActive && processActiveFile(ev.document));
    window.onDidChangeActiveTextEditor((ev) => ev && isActive && processActiveFile(ev.document));
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
