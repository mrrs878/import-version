/*
 * @Author: mrrs878@foxmail.com
 * @Date: 2022-02-17 21:37:04
 * @LastEditors: mrrs878@foxmail.com
 * @LastEditTime: 2022-02-17 21:37:04
 */

import * as fs from 'fs';
import fetch from 'node-fetch';
import * as path from 'path';
import { sync as packageDirectorySync } from 'pkg-dir';
import * as shell from 'shelljs';
import { window } from 'vscode';
import AbortController from 'abort-controller';

function parseJson(dir: string) {
  const pkg = path.join(dir, 'package.json');
  return JSON.parse(fs.readFileSync(pkg, 'utf-8'));
}

function getPackageName(pkg: any) {
  const pkgParts = pkg.name.split('/');
  let pkgName = pkgParts.shift();
  if (pkgName.startsWith('@')) {
    pkgName = path.join(pkgName, pkgParts.shift());
  }
  return pkgName;
}

/**
 * @param {Object} pkg
 * @returns {string} The location of a node_modules folder containing this package.
 */
function getPackageModuleContainer(pkg: any) {
  let currentDir = path.dirname(pkg.fileName);
  let foundDir = '';
  const pkgName = getPackageName(pkg);

  while (!foundDir) {
    const projectDir = packageDirectorySync(currentDir);
    if (!projectDir) {
      throw new Error(`Package directory not found [${pkg.name}]`);
    }
    const modulesDirectory = path.join(projectDir, 'node_modules');
    if (fs.existsSync(path.resolve(modulesDirectory, pkgName))) {
      foundDir = modulesDirectory;
    } else {
      currentDir = path.resolve(currentDir, '..');
    }
  }
  return foundDir;
}

/**
 * @param {Object} pkg
 * @returns {string} The actual location on-disk for this package.
 */
function getPackageDirectory(pkg: any) {
  const pkgName = getPackageName(pkg);

  const tmp = getPackageModuleContainer(pkg);
  return path.resolve(tmp, pkgName);
}

function getPackageJson(pkg: any) {
  return parseJson(getPackageDirectory(pkg));
}

function getLocalPackageVersion(pkg: any) {
  const { version } = getPackageJson(pkg);
  return version;
}

function getRemotePackageVersion(pkg: any) {
  return new Promise<string>((resolve, reject) => {
    const pkgInfo = shell.exec(`npm view ${pkg.name} version`, {
      async: true,
    });
    let versionInfo = '';
    pkgInfo.stdout?.on('data', (data) => {
      versionInfo += data;
    });
    pkgInfo.stdout?.on('close', () => {
      const version = versionInfo?.replace(/([^\d.])/g, '');
      resolve(version || '0.0.0');
    });
    pkgInfo.stdout?.on('error', (e) => {
      reject(new Error(e.message));
    });
  });
}

function compareVersion(localVersion: string, remoteVersion: string) {
  const localVersions = localVersion.split('.');
  const remoteVersions = remoteVersion.split('.');

  for (let index = 0; index < remoteVersions.length; index += 1) {
    if (remoteVersions[index] > localVersions[index]) {
      return false;
    }
  }

  return true;
}

async function getPackageVersion(pkg: Package) {
  const localVersion = getLocalPackageVersion(pkg);
  const remoteVersion = await getRemotePackageVersion(pkg);
  const isLastVersion = compareVersion(localVersion, remoteVersion);
  return ({
    ...pkg,
    localVersion,
    remoteVersion,
    isLastVersion,
  });
}

async function checkRegistryStatus() {
  const { stdout: registry } = shell.exec('npm config get registry');
  const controller = new AbortController();

  const timerId = setTimeout(() => {
    controller.abort();
  }, 15000);

  try {
    const res = await fetch(registry, {
      signal: controller.signal,
    });

    if (res.ok) {
      clearTimeout(timerId);
    }
  } catch (e) {
    window.showInformationMessage((`npm registry(${registry}) is not available`));
  } finally {
    clearTimeout(timerId);
  }
}

function initNodePath() {
  if (shell.which('node')?.toString()) {
    shell.config.execPath = shell.which('node')?.toString() || '';
  } else {
    throw new Error('Node.js exec path is not available');
  }
}

function isBuiltInModule(moduleName: string) {
  return !!(process.binding('natives')[moduleName]);
}

export {
  getPackageJson,
  getPackageModuleContainer,
  getPackageDirectory,
  getLocalPackageVersion,
  getRemotePackageVersion,
  getPackageVersion,
  parseJson,
  compareVersion,
  checkRegistryStatus,
  initNodePath,
  isBuiltInModule,
};
