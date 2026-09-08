import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';

import ts from 'typescript';

const expectedModules = {
  'apps/gateway/src/app.module.ts': {
    imports: ['ConfigModule.forRoot', 'GatewayModule'],
    providers: [
      'OrderWorkflowSubscriptionClient',
      'OrderWorkflowSubscriptionPort',
      'ForwardGatewaySubscriptionUseCase',
      'GatewaySseHandler',
      'GatewaySseMiddleware',
    ],
    exports: [],
  },
  'apps/identity-subgraph/src/app.module.ts': {
    imports: ['ConfigModule.forRoot', 'IdentityModule'],
    providers: [],
    exports: [],
  },
  'apps/order-workflow-subgraph/src/app.module.ts': {
    imports: [
      'ConfigModule.forRoot',
      'PersistenceModule',
      'OrderEventsModule',
      'MessagingModule',
      'OrderWorkflowGraphqlModule',
    ],
    providers: [],
    exports: [],
  },
  'apps/order-workflow-subgraph/src/checkout/checkout.module.ts': {
    imports: ['PersistenceModule'],
    providers: [
      'WOO_CHECKOUT',
      'CHECKOUT_REPOSITORY',
      'OUTBOX_REPOSITORY',
      'CheckoutService',
    ],
    exports: ['CheckoutService'],
  },
  'apps/order-workflow-subgraph/src/graphql/order-workflow-graphql.module.ts': {
    imports: [
      'PersistenceModule',
      'CheckoutModule',
      'OrderEventsModule',
      'OAuthResourceModule.register',
      'GraphQLModule.forRoot',
    ],
    providers: [
      'OrderWorkflowOperationsService',
      'ORDER_WORKFLOW_OPERATIONS',
      'OrderWorkflowResolver',
      'OrderWorkflowSubscriptionResolver',
      'OrderWorkflowSseConnections',
      'OrderWorkflowSseMiddleware',
      'APP_GUARD',
    ],
    exports: [],
  },
  'apps/order-workflow-subgraph/src/messaging/messaging.module.ts': {
    imports: ['PersistenceModule'],
    providers: ['OrderWorkflowRuntimeLifecycle'],
    exports: ['OrderWorkflowRuntimeLifecycle'],
  },
  'apps/order-workflow-subgraph/src/order-events/order-events.module.ts': {
    imports: ['PersistenceModule'],
    providers: [
      'OrderEventBroker',
      'MikroOrmOrderEventReplay',
      'PostgresOrderEventRelay',
      'OrderEventsSubscription',
    ],
    exports: [
      'OrderEventBroker',
      'OrderEventsSubscription',
      'PostgresOrderEventRelay',
    ],
  },
  'apps/order-workflow-subgraph/src/persistence/persistence.module.ts': {
    imports: [],
    providers: ['ORDER_WORKFLOW_ORM', 'ORDER_WORKFLOW_ENTITY_MANAGER'],
    exports: ['ORDER_WORKFLOW_ORM', 'ORDER_WORKFLOW_ENTITY_MANAGER'],
  },
  'libs/gateway/nest/src/auth/gateway-auth.module.ts': {
    imports: ['ConfigModule', 'OAuthResourceModule.register'],
    providers: [
      'CommerceCookieAdapter',
      'CommerceCookiePort',
      'TokenVerifierService',
      'GatewayTokenVerifierPort',
      'CreateGatewayContextUseCase',
      'AuthContextFactory',
    ],
    exports: [
      'CommerceCookiePort',
      'TokenVerifierService',
      'AuthContextFactory',
    ],
  },
  'libs/gateway/nest/src/federation/gateway-federation.module.ts': {
    imports: ['ConfigModule', 'GatewayAuthModule'],
    providers: [
      'PrepareFederationRequestUseCase',
      'CaptureFederationResponseUseCase',
      'GatewayFederationConfiguration',
    ],
    exports: ['GatewayFederationConfiguration'],
  },
  'libs/gateway/nest/src/gateway.module.ts': {
    imports: [
      'GatewayAuthModule',
      'GatewayFederationModule',
      'GraphQLModule.forRootAsync',
    ],
    providers: [],
    exports: ['GatewayAuthModule'],
  },
  'libs/identity/nest/src/better-auth/better-auth.module.ts': {
    imports: [
      'IdentityAuthProvidersModule',
      'RegistrationModule',
      'NestJSBetterAuth.forRootAsync',
    ],
    providers: [],
    exports: ['NestJSBetterAuth'],
  },
  'libs/identity/nest/src/better-auth/identity-auth-providers.module.ts': {
    imports: [],
    providers: [
      'IdentityDatabasePool',
      'BetterAuthFactory',
      'IdentityAuthProvider.value',
    ],
    exports: ['IdentityAuthToken.value'],
  },
  'libs/identity/nest/src/identity.module.ts': {
    imports: [
      'BetterAuthModule',
      'OAuthIssuerModule',
      'OAuthResourceModule.register',
      'GraphQLModule.forRoot',
    ],
    providers: [
      'BetterAuthIdentityUserAdapter',
      'IdentityUserQueryPort',
      'FindIdentityUsersUseCase',
      'ListIdentityUsersUseCase',
      'IdentityResolver',
      'UserLoader',
      'APP_GUARD',
    ],
    exports: [],
  },
  'libs/identity/nest/src/oauth-issuer/oauth-issuer.module.ts': {
    imports: ['BetterAuthModule'],
    providers: [
      'BetterAuthOAuthClientProvisioningAdapter',
      'EnvironmentOAuthSeedCredentialsAdapter',
      'OAuthClientProvisioningPort',
      'OAuthSeedCredentialsPort',
      'ProvisionOAuthClientsUseCase',
      'OAuthClientProvisioningService',
    ],
    exports: [],
  },
  'libs/identity/nest/src/registration/registration.module.ts': {
    imports: ['WordPressModule'],
    providers: [
      'CustomerIdentityPort',
      'CompensateRegistrationUseCase',
      'RegisterIdentityUseCase',
      'RegistrationService',
    ],
    exports: ['RegistrationService'],
  },
  'libs/identity/nest/src/wordpress/wordpress.module.ts': {
    imports: ['ConfigModule'],
    providers: [
      'WordPressConfiguration',
      'WordPressIdentityService',
      'WordPressCustomerIdentityAdapter',
    ],
    exports: ['WordPressIdentityService', 'WordPressCustomerIdentityAdapter'],
  },
  'libs/platform/nest/src/oauth-resource/oauth-resource.module.ts': {
    imports: [],
    providers: [
      'OAuthResourceOptionsToken',
      'OAuthCredentialVerifierPort',
      'VerifyOAuthCredentialUseCase',
      'OAuthResourceService',
      'GraphqlOAuthResourceGuard',
    ],
    exports: ['OAuthResourceService', 'GraphqlOAuthResourceGuard'],
  },
};

const expectedManualUseCases = [];
const expectedRuntimeBoundaries = [
  'apps/order-workflow-subgraph/src/messaging/order-workflow-messaging.runtime.ts',
  'libs/gateway/nest/src/federation/gateway-federation.configuration.ts',
  'libs/identity/nest/src/registration/registration.service.ts',
];

async function productionTypeScriptFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory())
      files.push(...(await productionTypeScriptFiles(path)));
    else if (
      entry.name.endsWith('.ts') &&
      !entry.name.endsWith('.spec.ts') &&
      !entry.name.endsWith('.test.ts') &&
      !entry.name.endsWith('.d.ts')
    ) {
      files.push(path);
    }
  }
  return files;
}

function metadataEntry(node, sourceFile) {
  if (ts.isObjectLiteralExpression(node)) {
    const token = node.properties.find(
      (property) =>
        ts.isPropertyAssignment(property) &&
        property.name.getText(sourceFile) === 'provide',
    );
    return token.initializer.getText(sourceFile);
  }
  if (ts.isCallExpression(node)) return node.expression.getText(sourceFile);
  return node.getText(sourceFile);
}

function moduleMetadata(path, source) {
  const sourceFile = ts.createSourceFile(
    path,
    source,
    ts.ScriptTarget.Latest,
    true,
  );
  const metadata = { imports: [], providers: [], exports: [] };

  function collect(object) {
    for (const property of object.properties) {
      if (
        !ts.isPropertyAssignment(property) ||
        !ts.isArrayLiteralExpression(property.initializer)
      )
        continue;
      const name = property.name.getText(sourceFile);
      if (name in metadata) {
        metadata[name].push(
          ...property.initializer.elements.map((entry) =>
            metadataEntry(entry, sourceFile),
          ),
        );
      }
    }
  }

  function visit(node) {
    if (
      ts.isCallExpression(node) &&
      node.expression.getText(sourceFile) === 'Module'
    ) {
      const [argument] = node.arguments;
      if (argument && ts.isObjectLiteralExpression(argument)) collect(argument);
    }
    if (
      ts.isReturnStatement(node) &&
      node.expression &&
      ts.isObjectLiteralExpression(node.expression)
    ) {
      const hasModule = node.expression.properties.some(
        (property) =>
          ts.isPropertyAssignment(property) &&
          property.name.getText(sourceFile) === 'module',
      );
      if (hasModule) collect(node.expression);
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return metadata;
}

test('AC-275: every NestJS module preserves explicit boundaries @spec:AC-275', async () => {
  const files = [
    ...(await productionTypeScriptFiles('apps')),
    ...(await productionTypeScriptFiles('libs')),
  ].sort();
  const sources = new Map(
    await Promise.all(
      files.map(async (file) => [file, await readFile(file, 'utf8')]),
    ),
  );
  const moduleFiles = files.filter((file) =>
    sources.get(file).includes('@Module('),
  );

  assert.deepEqual(moduleFiles, Object.keys(expectedModules));
  for (const file of moduleFiles) {
    const metadata = moduleMetadata(file, sources.get(file));
    assert.deepEqual(metadata, expectedModules[file], file);
    assert.equal(
      new Set(metadata.providers).size,
      metadata.providers.length,
      file,
    );
  }

  const productionSource = [...sources.values()].join('\n');
  assert.doesNotMatch(productionSource, /\bModuleRef\b|\bforwardRef\s*\(/);
  assert.doesNotMatch(
    productionSource,
    /\bstatic\s+(?:readonly\s+)?(?:instance|singleton)\b|\bgetInstance\s*\(/,
  );

  const manualUseCases = [];
  for (const [file, source] of sources) {
    for (const match of source.matchAll(
      /\bnew\s+([A-Z][A-Za-z0-9]*UseCase)\s*\(/g,
    )) {
      manualUseCases.push(`${file}:${match[1]}`);
    }
  }
  assert.deepEqual(manualUseCases.sort(), expectedManualUseCases);

  const report = await readFile(
    'docs/architecture/idiomatic-nestjs-module-audit.md',
    'utf8',
  );
  for (const file of moduleFiles)
    assert.match(report, new RegExp(`\\b${file.replaceAll('.', '\\.')}`));
  for (const site of expectedManualUseCases)
    assert.match(report, new RegExp(site.replaceAll('.', '\\.')));
  for (const site of expectedRuntimeBoundaries)
    assert.match(report, new RegExp(site.replaceAll('.', '\\.')));
  assert.match(report, /No manual `\*UseCase` construction remains/);
});

test('AC-276: every task starts one fresh Codex session and commits atomically @spec:AC-276', async () => {
  const executor = await readFile(
    '.spec/features/idiomatic-nestjs-architecture/executar-tarefas.sh',
    'utf8',
  );
  const dispatched = [
    ...executor.matchAll(
      /^\s*(?:if\s+)?rodar_tarefa\s+(?:'[^']+'|seq)\s+'(T-\d+)'/gm,
    ),
  ].map((match) => match[1]);
  const prompts = [
    ...executor.matchAll(/Sua tarefa \(somente ela\):\n(T-\d+)/g),
  ].map((match) => match[1]);

  assert.deepEqual(dispatched, ['T-227', 'T-229']);
  assert.deepEqual(prompts, dispatched);
  assert.equal(new Set(dispatched).size, dispatched.length);
  assert.equal((executor.match(/^\s*if codex exec "\$3"/gm) ?? []).length, 1);
  assert.doesNotMatch(executor, /codex exec resume|codex resume/);
  assert.equal(
    (executor.match(/Ao final de CADA tarefa: .*commit próprio\./g) ?? [])
      .length,
    dispatched.length,
  );

  const runAll = executor.slice(
    executor.indexOf('executar_tudo() {'),
    executor.indexOf('\nlistar() {'),
  );
  assert.ok(
    runAll.indexOf('executar_seq_T_227') <
      runAll.indexOf('executar_seq_T_229'),
  );
});
