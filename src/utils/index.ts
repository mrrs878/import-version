/*
 * @Author: mrrs878@foxmail.com
 * @Date: 2022-02-12 14:52:19
 * @LastEditors: mrrs878@foxmail.com
 * @LastEditTime: 2022-02-13 23:22:16
 */

import * as fs from 'fs';
import * as path from 'path';
import { sync as packageDirectorySync } from 'pkg-dir';
import * as shell from 'shelljs';

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
  const pkgInfo = shell.exec(`npm view ${pkg.name} version`);
  const version = pkgInfo?.stdout?.replace(/([^\d.])/g, '');
  return version || '0.0.0';
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

function getPackageVersion(pkg: Package) {
  const localVersion = getLocalPackageVersion(pkg);
  const remoteVersion = getRemotePackageVersion(pkg);
  const isLastVersion = compareVersion(localVersion, remoteVersion);
  return Promise.resolve({
    ...pkg,
    localVersion,
    remoteVersion,
    isLastVersion,
  });
}

function checkRegistryStatus() {
  const { stdout: registry } = shell.exec('npm config get registry');
  const domain = registry.replace(/http(s?):\/\/|\//ig, '');
  const pong = shell.exec(`ping ${domain}`, {
    timeout: 4000,
    async: true,
  });
  let pingMessage = '';
  pong.stdout?.on('data', (data) => {
    pingMessage += data;
  });
  pong.stdout?.on('end', () => {
    const isRegistryAvailable = pingMessage?.match(/Request timeout/);
    if (isRegistryAvailable) {
      throw new Error(`npm registry(${registry}) is not available`);
    }
  });
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
