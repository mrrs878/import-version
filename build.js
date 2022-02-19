/*
* @Author: mrrs878@foxmail.com
* @Date: 2022-02-19 14:31:20
* @LastEditors: mrrs878@foxmail.com
* @LastEditTime: 2022-02-19 16:53:55
*/

/* eslint-disable no-console */
/* eslint-disable import/no-extraneous-dependencies */

const SPECIFIC_CONFIG = {
  development: {
    watch: true,
    minify: false,
  },
  production: {
    watch: false,
    minify: true,
  },
};

const stripNodeColonPlugin = {
  name: 'strip-node-colon',
  setup({ onResolve }) {
    onResolve(
      { filter: /^node:/ },
      (args) => ({ path: args.path.slice('node:'.length), external: true }),
    );
  },
};

const specificConfig = SPECIFIC_CONFIG[process.env.NODE_ENV || 'development'];
specificConfig.watch = specificConfig.watch
  ? {
    onRebuild(error) {
      console.log('[watch] build started');
      if (error) {
        error.errors.forEach((e) => console.error(
          `> ${e.location.file}:${e.location.line}:${e.location.column}: error: ${e.text}`,
        ));
      } else console.log('[watch] build finished');
    },
  }
  : false;

require('esbuild').build({
  entryPoints: ['./src/extension.ts'],
  bundle: true,
  outfile: 'out/extension.js',
  external: ['vscode', 'shelljs'],
  format: 'cjs',
  sourcemap: true,
  platform: 'node',
  plugins: [stripNodeColonPlugin],
  ...specificConfig,
}).then(() => {
  if (specificConfig.watch) {
    console.log('[watch] build finished');
  }
}).catch((e) => {
  console.log(e);
  process.exit(1);
});
