import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

import ts from 'typescript';

export const approvedProductionRoots = [
  'apps/gateway/src',
  'libs/gateway/nest/src',
  'apps/identity-subgraph/src',
  'libs/identity/nest/src',
  'libs/platform/nest/src',
  'apps/payment-federation/src/main/java/dev/desafio/transaction',
];

const isCatalogReference = (text) =>
  /\b\w*Messages\b/.test(text) || /\b\w*(?:Reason|Code)\.\w+\b/.test(text);
const lineAt = (source, index) => source.slice(0, index).split('\n').length;
const isExceptionName = (name) => /(?:Error|Exception|BusinessRejection)$/.test(name);

async function sources(root, sourceRoots) {
  const files = [];
  async function visit(path) {
    let entries;
    try {
      entries = await readdir(path, { withFileTypes: true });
    } catch (error) {
      if (error.code === 'ENOENT') return;
      throw error;
    }
    for (const entry of entries) {
      const file = join(path, entry.name);
      if (entry.isDirectory()) await visit(file);
      else if (
        /\.(?:ts|java)$/.test(entry.name) &&
        !/\.(?:spec|test)\.ts$/.test(entry.name)
      )
        files.push(file);
    }
  }
  await Promise.all(sourceRoots.map((path) => visit(join(root, path))));
  return files.sort();
}

function typeScriptViolations(file, source) {
  const document = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const violations = [];
  const add = (node, reason) => {
    const { line } = document.getLineAndCharacterOfPosition(node.getStart(document));
    violations.push({ file, line: line + 1, reason });
  };
  const expressionText = (node) => node?.getText(document) ?? '';
  const messageReason = (expression) => {
    const text = expressionText(expression);
    if (!expression) return 'missing-message';
    if (isCatalogReference(text)) return null;
    if (ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression) || ts.isTemplateExpression(expression)) return 'inline-message';
    return 'unnamed-message';
  };

  function visit(node) {
    if (ts.isThrowStatement(node) && ts.isNewExpression(node.expression)) {
      const error = node.expression;
      const name = expressionText(error.expression).split('.').at(-1);
      if (isExceptionName(name)) {
        const argumentsText = (error.arguments ?? []).map(expressionText).join(', ');
        const reason = !error.arguments?.length
          ? 'missing-message'
          : isCatalogReference(argumentsText)
            ? null
            : messageReason(error.arguments[0]);
        if (reason) add(error, reason);
      }
    }
    if (ts.isClassDeclaration(node) && node.name && node.heritageClauses?.some((clause) => clause.types.some((type) => isExceptionName(expressionText(type.expression))))) {
      const constructors = node.members.filter(ts.isConstructorDeclaration);
      if (!constructors.length) add(node, 'missing-default-message');
      for (const constructor of constructors.filter((item) => !item.parameters.length)) {
        const superCall = constructor.body?.statements.find((statement) => ts.isExpressionStatement(statement) && ts.isCallExpression(statement.expression) && expressionText(statement.expression.expression) === 'super');
        if (!superCall || !isCatalogReference(expressionText(superCall))) add(constructor, 'missing-default-message');
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(document);
  return violations;
}

function withoutComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, (comment) =>
    comment.replace(/[^\n]/g, ' '),
  );
}

function javaMessageTypes(files) {
  const types = new Set();
  for (const { source } of files) {
    for (const match of source.matchAll(/class\s+(\w+)\s+extends\s+[\w.]+(?:Exception|Error)\b/g)) {
      const start = source.indexOf('{', match.index + match[0].length);
      if (start < 0) continue;
      let depth = 0;
      let end = start;
      for (; end < source.length; end += 1) {
        if (source[end] === '{') depth += 1;
        if (source[end] === '}' && --depth === 0) break;
      }
      if (isCatalogReference(source.slice(start, end + 1))) types.add(match[1]);
    }
  }
  return types;
}

function javaViolations(file, source, messageTypes) {
  const violations = [];
  const code = withoutComments(source);
  for (const match of code.matchAll(/throw\s+new\s+([\w.]+)\s*\(([^;]*?)\)/g)) {
    const [, type, argumentsText] = match;
    if (!isExceptionName(type.split('.').at(-1))) continue;
    if (messageTypes.has(type.split('.').at(-1))) continue;
    const text = argumentsText.trim();
    const reason = !text
      ? 'missing-message'
      : isCatalogReference(text)
        ? null
        : /["']/.test(text)
          ? 'inline-message'
          : 'unnamed-message';
    if (reason)
      violations.push({ file, line: lineAt(source, match.index), reason });
  }
  for (const match of code.matchAll(/class\s+(\w+)\s+extends\s+[\w.]+(?:Exception|Error)\b/g)) {
    const [declaration, name] = match;
    const body = code.slice(match.index + declaration.length);
    const constructors = [...body.matchAll(new RegExp(`\\b${name}\\s*\\(([^)]*)\\)\\s*\\{([\\s\\S]*?)\\}`, 'g'))];
    if (!constructors.length) {
      violations.push({ file, line: lineAt(source, match.index), reason: 'missing-default-message' });
      continue;
    }
    for (const constructor of constructors.filter((item) => !item[1].trim())) {
      const superCall = constructor[2].match(/super\s*\(([^)]*)\)/);
      if (!superCall || !isCatalogReference(superCall[1]))
        violations.push({ file, line: lineAt(source, match.index), reason: 'missing-default-message' });
    }
  }
  return violations;
}

export async function scanErrorMessagePolicy({ root = process.cwd(), sourceRoots = approvedProductionRoots } = {}) {
  const files = [];
  for (const path of await sources(root, sourceRoots)) {
    const source = await readFile(path, 'utf8');
    const file = relative(root, path).split('\\').join('/');
    files.push({ file, path, source });
  }
  const messageTypes = javaMessageTypes(files.filter(({ path }) => path.endsWith('.java')));
  const violations = files.flatMap(({ file, path, source }) =>
    path.endsWith('.java')
      ? javaViolations(file, source, messageTypes)
      : typeScriptViolations(file, source),
  );
  return violations.sort((left, right) => left.file.localeCompare(right.file) || left.line - right.line || left.reason.localeCompare(right.reason));
}

export function assertErrorMessagePolicy(violations) {
  if (violations.length)
    throw new Error(
      violations.map(({ file, line, reason }) => `${file}:${line} ${reason}`).join('\n'),
    );
}

if (import.meta.main) {
  const violations = await scanErrorMessagePolicy();
  try {
    assertErrorMessagePolicy(violations);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
