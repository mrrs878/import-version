/*
 * @Author: mrrs878@foxmail.com
 * @Date: 2022-02-15 22:03:12
 * @LastEditors: mrrs878@foxmail.com
 * @LastEditTime: 2022-02-19 16:41:06
 */

import { packageDirectorySync } from 'pkg-dir';
import { parseJson } from './packageVersion';

/**
 * @description: 获取package.json中的[dev][peer]dependencies
 * @param {string} fileName
 * @return {{ pkgs: Array<string>, pkgDir: string }}
 */
function getPackagesFromPackageJSON(fileName: string) {
  const pkgDir = packageDirectorySync({ cwd: fileName });
  if (!pkgDir) {
    throw new Error('No package.json');
  }
  const { devDependencies, dependencies, peerDependencies } = parseJson(pkgDir);
  return {
    pkgs: [
      ...Reflect.ownKeys(devDependencies || {}),
      ...Reflect.ownKeys(dependencies || {}),
      ...Reflect.ownKeys(peerDependencies || {}),
    ] as Array<string>,
    pkgDir,
  };
}

export { getPackagesFromPackageJSON };
