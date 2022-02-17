/*
 * @Author: mrrs878@foxmail.com
 * @Date: 2022-02-12 17:36:22
 * @LastEditors: mrrs878@foxmail.com
 * @LastEditTime: 2022-02-17 21:45:50
 */

import traverse from '@babel/traverse';
import {
  Identifier,
  isImportDefaultSpecifier,
  isImportNamespaceSpecifier,
  isImportSpecifier,
  isTemplateLiteral,
} from '@babel/types';
import { parse as jsParse, ParserPlugin } from '@babel/parser';
import { isBuiltInModule } from './packageVersion';

type BabelNode = any;

const TYPESCRIPT = 'typescript';

const PARSE_PLUGINS: Array<ParserPlugin> = [
  'jsx',
  'doExpressions',
  'objectRestSpread',
  ['decorators', { decoratorsBeforeExport: true }],
  'classProperties',
  'asyncGenerators',
  'functionBind',
  'functionSent',
  'dynamicImport',
];
const PARSE_JS_PLUGINS: Array<ParserPlugin> = ['flow', ...PARSE_PLUGINS];
const PARSE_TS_PLUGINS: Array<ParserPlugin> = ['typescript', ...PARSE_PLUGINS];

function parse(source, language) {
  const plugins = (language === TYPESCRIPT ? PARSE_TS_PLUGINS : PARSE_JS_PLUGINS);
  return jsParse(source, {
    sourceType: 'module',
    plugins,
  });
}

function compileImportString(node: BabelNode) {
  let importSpecifiers: string | undefined;
  let importString: Array<any> | string;

  if (node?.specifiers && node.specifiers.length > 0) {
    importString = []
      .concat(node.specifiers)
      .sort((s1: any, s2: any) => {
        if (isImportSpecifier(s1) && isImportSpecifier(s2)) {
          return (s1.imported as Identifier).name < (s2.imported as Identifier).name ? -1 : 1;
        }
        return 0;
      })
      .map((specifier: any, i) => {
        if (isImportNamespaceSpecifier(specifier)) {
          return `* as ${specifier.local.name}`;
        } if (isImportDefaultSpecifier(specifier)) {
          return specifier.local.name;
        } if (isImportSpecifier(specifier)) {
          if (!importSpecifiers) {
            importSpecifiers = '{';
          }
          importSpecifiers += (specifier.imported as Identifier).name;
          if (
            node.specifiers[i + 1]
            && isImportSpecifier(node.specifiers[i + 1])
          ) {
            importSpecifiers += ', ';
            return undefined;
          }
          const result = `${importSpecifiers}}`;
          importSpecifiers = undefined;
          return result;
        }
        return undefined;
      })
      .filter((x) => x)
      .join(', ');
  } else {
    importString = '* as tmp';
  }
  return `import ${importString} from '${
    node.source.value
  }';\nconsole.log(${importString.replace('* as ', '')});`;
}

function getPackageName(node: any) {
  return isTemplateLiteral(node.arguments[0])
    ? node.arguments[0].quasis[0].value.raw
    : node.arguments[0].value;
}

function compileRequireString(node) {
  return `import('${getPackageName(node)}')`;
}

function compileImportExpressionString(node) {
  return `import('${getPackageName(node)}').then(res => console.log(res));`;
}

export function getPackages(fileName: string, source: string, language: string, lineOffset = 0) {
  const packages: Array<any> = [];
  const visitor = {
    ImportDeclaration({ node }) {
      if (node.importKind !== 'type') {
        packages.push({
          fileName,
          name: node.source.value,
          line: node.loc.end.line + lineOffset,
          string: compileImportString(node),
        });
      }
    },
    CallExpression({ node }) {
      if (node.callee.name === 'require') {
        packages.push({
          fileName,
          name: getPackageName(node),
          line: node.loc.end.line + lineOffset,
          string: compileRequireString(node),
        });
      } else if (node.callee.type === 'Import') {
        packages.push({
          fileName,
          name: getPackageName(node),
          line: node.loc.end.line + lineOffset,
          string: compileImportExpressionString(node),
        });
      }
    },
  };

  const ast = parse(source, language);
  traverse(ast, visitor);
  return packages;
}

export function filterPackages(packageInfo: Package) {
  return !(
    packageInfo.name.startsWith('.')
    || isBuiltInModule(packageInfo.name)
  );
}
