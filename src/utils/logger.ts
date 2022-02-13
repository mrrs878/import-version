/*
 * @Author: mrrs878@foxmail.com
 * @Date: 2022-02-12 16:55:55
 * @LastEditors: mrrs878@foxmail.com
 * @LastEditTime: 2022-02-13 17:02:59
 */

import {
  OutputChannel, ExtensionContext, window, workspace,
} from 'vscode';

class Logger {
  private channel: OutputChannel | undefined;

  private context: ExtensionContext | undefined;

  private debug: boolean = !!workspace.getConfiguration('importVersion').debug;

  init(context: ExtensionContext) {
    this.context = context;
    if (this.debug) {
      this.channel = window.createOutputChannel('ImportVersion');
      context.subscriptions.push(this.channel);
    }
  }

  log(text: string) {
    if (this.debug) {
      this.channel?.appendLine(text);
    }
  }
}

export default new Logger();
