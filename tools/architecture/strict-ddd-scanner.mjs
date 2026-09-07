import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import ts from 'typescript';

import {
  forbiddenCoreDependencies,
  isCoreLayer,
  isDedicatedFile,
} from './strict-ddd-policy.mjs';

// DDD decision: Platform, Gateway, and Identity own this structural use case;
// no aggregate or ports are involved. Each source file is the consistency boundary.
const declarationKinds = new Set([
  ts.SyntaxKind.ClassDeclaration,
  ts.SyntaxKind.InterfaceDeclaration,
  ts.SyntaxKind.TypeAliasDeclaration,
  ts.SyntaxKind.EnumDeclaration,
  ts.SyntaxKind.FunctionDeclaration,
  ts.SyntaxKind.VariableStatement,
]);

function normalized(file) {
  return file.split('\\').join('/');
}

function violation(file, node, code, declaration, source) {
  return {
    code,
    declaration,
    file,
    line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1,
  };
}

function declarationName(node) {
  if (ts.isVariableStatement(node)) {
    return node.declarationList.declarations[0]?.name.getText() ?? 'variable';
  }
  return node.name?.getText() ?? ts.SyntaxKind[node.kind];
}

function allowsFunctionalArtifact(file, statements) {
  if (file.endsWith('/index.ts') || file.endsWith('.d.ts')) return true;
  if (file.endsWith('/main.ts') || file.endsWith('.config.ts')) return true;
  if (file.includes('/migrations/') || file.includes('/generated/'))
    return true;
  if (!file.endsWith('.decorator.ts')) return false;
  const declarations = statements.filter((statement) =>
    declarationKinds.has(statement.kind),
  );
  return declarations.length === 1 && ts.isVariableStatement(declarations[0]);
}

function scanSource(file, text) {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const path = normalized(file);
  const violations = [];
  const declarations = source.statements.filter((statement) =>
    declarationKinds.has(statement.kind),
  );

  if (
    !isDedicatedFile(path) ||
    !allowsFunctionalArtifact(path, source.statements)
  ) {
    const classes = declarations.filter(ts.isClassDeclaration);
    for (const declaration of declarations) {
      if (classes.length === 1 && declaration === classes[0]) continue;
      violations.push(
        violation(
          path,
          declaration,
          'mixed-declaration',
          declarationName(declaration),
          source,
        ),
      );
    }
  }

  if (path.endsWith('.port.ts')) {
    for (const declaration of declarations.filter(ts.isClassDeclaration)) {
      if (
        !declaration.modifiers?.some(
          (modifier) => modifier.kind === ts.SyntaxKind.AbstractKeyword,
        )
      ) {
        violations.push(
          violation(
            path,
            declaration,
            'port-must-be-abstract',
            declarationName(declaration),
            source,
          ),
        );
      }
    }
  }

  if (isCoreLayer(path)) {
    for (const statement of source.statements.filter(ts.isImportDeclaration)) {
      const specifier = statement.moduleSpecifier.text;
      if (
        forbiddenCoreDependencies.some((pattern) => pattern.test(specifier))
      ) {
        violations.push(
          violation(path, statement, 'forbidden-dependency', specifier, source),
        );
      }
    }
    ts.forEachChild(source, function visit(node) {
      if (ts.canHaveDecorators(node) && ts.getDecorators(node)?.length) {
        violations.push(
          violation(
            path,
            node,
            'framework-decorator',
            node.getText(source).split(/\s|\{/)[0],
            source,
          ),
        );
      }
      ts.forEachChild(node, visit);
    });
  }

  return violations;
}

export function scanFiles(inputs) {
  return inputs
    .flatMap((input) => {
      if (typeof input === 'string') {
        return scanSource(normalized(input), ts.sys.readFile(input) ?? '');
      }
      return scanSource(normalized(input.file), input.source);
    })
    .sort((left, right) =>
      `${left.file}:${left.line}:${left.declaration}`.localeCompare(
        `${right.file}:${right.line}:${right.declaration}`,
      ),
    );
}

async function typescriptFiles(root) {
  const files = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const path = `${root}/${entry.name}`;
    if (entry.isDirectory()) files.push(...(await typescriptFiles(path)));
    else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.spec.ts'))
      files.push(path);
  }
  return files;
}

export async function scanRoots(roots, { cwd = process.cwd() } = {}) {
  const files = (
    await Promise.all(roots.map((root) => typescriptFiles(resolve(cwd, root))))
  ).flat();
  const sources = await Promise.all(
    files.map(async (file) => ({
      file: normalized(file.slice(cwd.length + 1)),
      source: await readFile(file, 'utf8'),
    })),
  );
  return scanFiles(sources);
}

export function baselineGrowth(violations, baseline) {
  const accepted = new Set(
    baseline.violations.map(
      ({ code, declaration, file, line }) =>
        `${code}:${file}:${line}:${declaration}`,
    ),
  );
  return violations.filter(
    ({ code, declaration, file, line }) =>
      !accepted.has(`${code}:${file}:${line}:${declaration}`),
  );
}

export function taskManifestScopeViolations(taskManifest) {
  return taskManifest
    .split('\n')
    .filter((line) => line.startsWith('- Arquivos:'))
    .filter((line) => /(?:apps\/)?order-workflow-subgraph\//.test(line))
    .map((line) => ({
      code: 'excluded-order-workflow',
      declaration: line.slice('- Arquivos: '.length),
    }));
}
