/*
 * @Author: mrrs878@foxmail.com
 * @Date: 2022-02-17 22:33:00
 * @LastEditors: mrrs878@foxmail.com
 * @LastEditTime: 2022-02-17 23:17:36
 */

import fetch from 'node-fetch';
import shell from 'shelljs';
import AbortController from 'abort-controller';
import { sleep } from './common';

let registryIsAvailable = true;

function getRegistryStatus() {
  return registryIsAvailable;
}

async function check(silence = false) {
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
      registryIsAvailable = true;
      clearTimeout(timerId);
    }
  } catch (e) {
    registryIsAvailable = false;
    if (!silence) {
      throw new Error(`npm registry(${registry}) is not available`);
    }
  } finally {
    clearTimeout(timerId);
  }
}

const MAX_SLEEP = 128;

async function checkRegistryStatusRetry() {
  for (let i = 0; i < MAX_SLEEP; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await check(true);
    if (registryIsAvailable) {
      return;
    }

    if (i <= MAX_SLEEP / 2) {
      // eslint-disable-next-line no-await-in-loop
      await sleep(i * 1000);
    }
  }
}

export { checkRegistryStatusRetry, check as checkRegistryStatus, getRegistryStatus };
