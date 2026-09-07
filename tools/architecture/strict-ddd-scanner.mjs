import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import ts from 'typescript';

import {
  classifyRepositoryPath,
  forbiddenCoreDependencies,
  isConfigFile,
  isCoreLayer,
  isDedicatedFile,
  isExcludedRepositoryPath,
  isIgnoredRepositoryPath,
  isProductionSource,
  isProductionTypeScript,
  repositoryApplicationExclusions,
  usesStrictTypeScriptRules,
} from './strict-ddd-policy.mjs';

// DDD decision: repository architecture governance owns this technical use case.
// There is no aggregate or port; one repository snapshot is the consistency boundary.
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
  if (file.endsWith('/main.ts')) return true;
  if (file.includes('/migrations/') || file.includes('/generated/'))
    return true;
  if (!file.endsWith('.decorator.ts')) return false;
  const declarations = statements.filter((statement) =>
    declarationKinds.has(statement.kind),
  );
  return declarations.length === 1 && ts.isVariableStatement(declarations[0]);
}

function isVendorConfigExport(statements) {
  const nonImports = statements.filter(
    (statement) => !ts.isImportDeclaration(statement),
  );
  const config = nonImports[0];
  const importsRegisterAs = statements.some(
    (statement) =>
      ts.isImportDeclaration(statement) &&
      statement.moduleSpecifier.text === '@nestjs/config' &&
      statement.importClause?.namedBindings &&
      ts.isNamedImports(statement.importClause.namedBindings) &&
      statement.importClause.namedBindings.elements.some(
        (element) => element.name.text === 'registerAs',
      ),
  );
  return (
    nonImports.length === 1 &&
    importsRegisterAs &&
    ts.isExportAssignment(config) &&
    !config.isExportEquals &&
    ts.isCallExpression(config.expression) &&
    ts.isIdentifier(config.expression.expression) &&
    config.expression.expression.text === 'registerAs'
  );
}

function scanSource(file, text) {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const path = normalized(file);
  const violations = [];
  const declarations = source.statements.filter((statement) =>
    declarationKinds.has(statement.kind),
  );

  if (isConfigFile(path)) {
    if (!isVendorConfigExport(source.statements)) {
      for (const statement of source.statements.filter(
        (entry) => !ts.isImportDeclaration(entry),
      )) {
        violations.push(
          violation(
            path,
            statement,
            'invalid-config-exception',
            declarationName(statement),
            source,
          ),
        );
      }
    }
    return violations;
  }

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

async function repositoryFiles(root, relative = '') {
  const files = [];
  for (const entry of await readdir(resolve(root, relative), {
    withFileTypes: true,
  })) {
    const file = normalized(
      relative ? `${relative}/${entry.name}` : entry.name,
    );
    if (isExcludedRepositoryPath(file) || isIgnoredRepositoryPath(file))
      continue;
    if (entry.isDirectory()) files.push(...(await repositoryFiles(root, file)));
    else if (entry.isFile()) files.push(file);
  }
  return files;
}

export async function inventoryRepository({ cwd = process.cwd() } = {}) {
  return (await repositoryFiles(cwd))
    .map((file) => ({ ...classifyRepositoryPath(file), file }))
    .sort((left, right) => left.file.localeCompare(right.file));
}

export async function scanRepository({ cwd = process.cwd() } = {}) {
  const inventory = await inventoryRepository({ cwd });
  const production = inventory.filter(({ file }) => isProductionSource(file));
  const unclassified = production
    .filter(({ boundary, context }) => !boundary || !context)
    .map(({ context, file }) => ({
      code: 'unclassified-production',
      declaration: context
        ? 'missing approved layer'
        : 'missing repository classification',
      file,
      line: 1,
    }));
  const sources = await Promise.all(
    production
      .filter(
        ({ file }) =>
          isProductionTypeScript(file) && usesStrictTypeScriptRules(file),
      )
      .map(async ({ file }) => ({
        file,
        source: await readFile(resolve(cwd, file), 'utf8'),
      })),
  );

  return [...unclassified, ...scanFiles(sources)].sort((left, right) =>
    `${left.file}:${left.line}:${left.code}:${left.declaration}`.localeCompare(
      `${right.file}:${right.line}:${right.code}:${right.declaration}`,
    ),
  );
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
  return taskManifest.split('\n').flatMap((line) => {
    if (!line.startsWith('- Arquivos:')) return [];
    const files = line.slice('- Arquivos: '.length).split(', ');
    return files
      .filter((file) =>
        repositoryApplicationExclusions.some(
          (root) => file === root || file.startsWith(`${root}/`),
        ),
      )
      .map((file) => ({ code: 'excluded-application', declaration: file }));
  });
}
