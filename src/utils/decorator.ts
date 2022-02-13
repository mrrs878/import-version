/*
 * @Author: mrrs878@foxmail.com
 * @Date: 2022-02-12 16:57:14
 * @LastEditors: mrrs878@foxmail.com
 * @LastEditTime: 2022-02-13 21:40:20
 */

import {
  workspace, window, Range, Position,
} from 'vscode';
import logger from './logger';

const decorations: Record<string, any> = {};

function getDecorationMessage(packageInfo: Package) {
  const { localVersion, remoteVersion, isLastVersion } = packageInfo;

  const decorationMessage = `version: ${localVersion}${isLastVersion ? '' : ` (lastVersion: ${remoteVersion})`}`;

  return decorationMessage;
}

function getDecorationColor(packageInfo: Pick<Package, 'isLastVersion'>) {
  const configuration = workspace.getConfiguration('importVersion');
  const { isLastVersion } = packageInfo;
  return configuration[isLastVersion === false ? 'legacyPackageColor' : 'lastPackageColor'];
}

const decorationType = window.createTextEditorDecorationType({ after: { margin: '0 0 0 1rem' } });

let decorationsDebounce: NodeJS.Timeout;

function getEditors(fileName: string) {
  return window.visibleTextEditors.filter((editor) => editor.document.fileName === fileName);
}

function refreshDecorations(fileName: string, delay = 10) {
  clearTimeout(decorationsDebounce);
  decorationsDebounce = setTimeout(
    () => getEditors(fileName).forEach((editor) => {
      editor.setDecorations(
        decorationType,
        Object.keys(decorations[fileName]).map((x) => decorations[fileName][x]),
      );
    }),
    delay,
  );
}

function decorate(
  text: string,
  packageInfo: Package,
  color = getDecorationColor({ isLastVersion: true }),
) {
  const { fileName, line } = packageInfo;
  logger.log(`Setting Decoration: ${text}, ${JSON.stringify(packageInfo, null, 2)}`);
  decorations[fileName][line] = {
    renderOptions: { after: { contentText: text, color } },
    range: new Range(new Position(line - 1, 1024), new Position(line - 1, 1024)),
  };
  refreshDecorations(fileName);
}

export function calculated(packageInfo: Package) {
  const decorationMessage = getDecorationMessage(packageInfo);
  decorate(decorationMessage, packageInfo, getDecorationColor(packageInfo));
}

export function flushDecorations(fileName: string, packages: Array<Package>) {
  logger.log(`Flushing decorations ${JSON.stringify(packages, null, 2)}`);
  decorations[fileName] = {};
  packages.forEach((packageInfo) => {
    if (packageInfo.localVersion === undefined) {
      const configuration = workspace.getConfiguration('importVersion');
      if (configuration.showCalculatingDecoration) {
        decorate('Calculating...', packageInfo);
      }
    } else {
      calculated(packageInfo);
    }
  });
  refreshDecorations(fileName);
}

export function clearDecorations() {
  window.visibleTextEditors.forEach((textEditor) => textEditor.setDecorations(decorationType, []));
}
