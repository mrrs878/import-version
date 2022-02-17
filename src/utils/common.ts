/*
 * @Author: mrrs878@foxmail.com
 * @Date: 2022-02-17 22:58:10
 * @LastEditors: mrrs878@foxmail.com
 * @LastEditTime: 2022-02-17 23:00:03
 */

// eslint-disable-next-line no-promise-executor-return
export const sleep = (timeout: number) => new Promise((resolve) => setTimeout(resolve, timeout));
