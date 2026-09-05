import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('AC-187: the complete credential-free gate records every required check without skips @spec:AC-187', async () => {
  const [sourcePackage, e2eProject, evidence] = await Promise.all([
    readFile('package.json', 'utf8').then(JSON.parse),
    readFile('apps/e2e/project.json', 'utf8').then(JSON.parse),
    readFile(
      'docs/evidence/mercado-pago-production-deployment/credential-free-gate.md',
      'utf8',
    ),
  ]);

  for (const script of [
    'test:spec',
    'quality:nx',
    'quality:coverage',
    'acceptance:milestone-7',
  ]) {
    assert.ok(sourcePackage.scripts[script], `missing ${script} quality gate`);
    assert.match(evidence, new RegExp('\\| `' + script + '`\\s+\\| PASS'));
  }
  assert.equal(e2eProject.targets.acceptance.cache, false);
  assert.doesNotMatch(evidence, /\\b(?:SKIP|TODO)\\b/i);
  assert.match(evidence, /Git revision: `[0-9a-f]{7,40}`/);
});

test('AC-188: the payment-critical gate covers Card, Pix, webhook, recovery, refund, and raw-card exclusion @spec:AC-188', async () => {
  const [providerTest, webhookTest, evidence] = await Promise.all([
    readFile(
      'apps/payment-federation/src/test/java/dev/desafio/transaction/payment/adapter/mercadopago/MercadoPagoPaymentProviderTest.java',
      'utf8',
    ),
    readFile(
      'apps/payment-federation/src/test/java/dev/desafio/transaction/payment/adapter/mercadopago/MercadoPagoWebhookControllerTest.java',
      'utf8',
    ),
    readFile(
      'docs/evidence/mercado-pago-production-deployment/credential-free-gate.md',
      'utf8',
    ),
  ]);

  for (const behavior of [
    /card/i,
    /pix/i,
    /idempot/i,
    /timeout|ambiguous|retry/i,
    /refund/i,
  ]) {
    assert.match(providerTest, behavior);
  }
  assert.match(webhookTest, /signature/i);
  assert.match(webhookTest, /unauthorized|401/i);
  assert.match(evidence, /Payment Federation Java tests.*PASS/);
  assert.match(evidence, /raw Card data exclusion.*PASS/i);
});

test('AC-189: sandbox Card and Pix retries are opt-in, unique, and redacted @spec:AC-189', async () => {
  const [project, verifier, verifierTest, runbook, compose, paymentConfig] =
    await Promise.all([
      readFile('apps/e2e/project.json', 'utf8').then(JSON.parse),
      readFile('apps/e2e/src/mercado-pago-sandbox.ts', 'utf8'),
      readFile('apps/e2e/src/mercado-pago-sandbox.test.ts', 'utf8'),
      readFile('docs/runbooks/mercado-pago-sandbox.md', 'utf8'),
      readFile('compose.yaml', 'utf8'),
      readFile(
        'apps/payment-federation/src/main/java/dev/desafio/transaction/payment/configuration/PaymentSecurityConfiguration.java',
        'utf8',
      ),
    ]);

  assert.equal(
    project.targets['mercado-pago-sandbox'].options.command,
    'node --import tsx apps/e2e/src/mercado-pago-sandbox.ts',
  );
  assert.equal(project.targets['mercado-pago-sandbox'].cache, false);
  assert.match(verifier, /MERCADO_PAGO_SANDBOX_CONFIRM/);
  assert.match(verifier, /MERCADO_PAGO_SANDBOX_CARD_ORDER_ID/);
  assert.match(verifier, /MERCADO_PAGO_SANDBOX_PIX_ORDER_ID/);
  assert.match(verifier, /Sandbox Card and Pix orders must be different/);
  assert.match(verifier, /CREATE_AND_REFUND_TEST_PAYMENTS/);
  assert.match(verifier, /randomUUID/);
  assert.match(verifier, /SHA-256|sha256/);
  assert.match(verifierTest, /authorizations\)\.toHaveLength\(4\)/);
  assert.match(verifierTest, /serialized\)\.not\.toContain\(secret\)/);
  assert.match(runbook, /only timestamps, unique operation keys, SHA-256/);
  assert.match(
    compose,
    /PAYMENT_PROVIDER_MODE: \$\{PAYMENT_PROVIDER_MODE:-deterministic\}/,
  );
  for (const variable of [
    'MERCADO_PAGO_ACCESS_TOKEN',
    'MERCADO_PAGO_WEBHOOK_SECRET',
    'MERCADO_PAGO_API_BASE_URL',
    'MERCADO_PAGO_CONNECTION_TIMEOUT',
    'MERCADO_PAGO_READ_TIMEOUT',
  ]) {
    assert.match(compose, new RegExp(`${variable}: \\$\\{${variable}`));
  }
  assert.match(runbook, /docker compose port payment-federation 8080/);
  assert.match(paymentConfig, /jwsAlgorithm\(SignatureAlgorithm\.ES256\)/);
  assert.match(paymentConfig, /new JOSEObjectType\("at\+jwt"\)/);
  assert.match(paymentConfig, /createDefaultWithIssuer\(issuer\)/);
  assert.match(paymentConfig, /"aud"/);
  assert.match(paymentConfig, /"client_id"/);
});

test('AC-190: sandbox webhooks and repeated refunds converge authoritatively @spec:AC-190', async () => {
  const [verifier, verifierTest, runbook] = await Promise.all([
    readFile('apps/e2e/src/mercado-pago-sandbox.ts', 'utf8'),
    readFile('apps/e2e/src/mercado-pago-sandbox.test.ts', 'utf8'),
    readFile('docs/runbooks/mercado-pago-sandbox.md', 'utf8'),
  ]);

  assert.match(verifier, /createHmac\('sha256'/);
  assert.match(verifier, /'ts=0,v1=invalid'/);
  assert.match(verifier, /providerRefund\.refundIds\.length/);
  assert.match(verifier, /payment\.status === 'REFUNDED'/);
  assert.match(verifierTest, /\[\s*401, 200, 200,?\s*\]/);
  assert.match(verifierTest, /new Set\(driver\.refundKeys\)\.size/);
  assert.match(runbook, /Replay the same `x-request-id`/);
  assert.doesNotMatch(
    verifier,
    /console\.(?:log|error)\([^)]*(?:accessToken|webhookSecret|cardToken|bearerToken)/,
  );
});

test('AC-189: operational sandbox evidence proves idempotent redacted Card and Pix payments @spec:AC-189', async () => {
  const evidence = JSON.parse(
    await readFile(
      'docs/evidence/mercado-pago-production-deployment/provider-sandbox.json',
      'utf8',
    ),
  );
  const records = evidence.records;

  assert.equal(evidence.stage, 'sandbox');
  assert.equal(evidence.result, 'passed');
  assert.match(
    evidence.executedAt,
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
  );
  assert.deepEqual(
    records.slice(0, 2).map(({ status }) => status),
    ['CARD_AUTHORIZED_IDEMPOTENT', 'PIX_GENERATED_IDEMPOTENT'],
  );
  for (const record of records) {
    assert.deepEqual(Object.keys(record).sort(), [
      'exitResult',
      'operationKey',
      'sanitizedReference',
      'status',
      'timestamp',
    ]);
    assert.match(
      record.timestamp,
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
    );
    assert.match(record.sanitizedReference, /^sha256:[a-f0-9]{16}$/);
    assert.equal(record.exitResult, 0);
  }
  assert.doesNotMatch(
    JSON.stringify(evidence),
    /accessToken|bearerToken|cardToken|webhookSecret|providerReference|rawPayload/,
  );
});

test('AC-190: operational sandbox evidence records webhook and refund convergence @spec:AC-190', async () => {
  const { records } = JSON.parse(
    await readFile(
      'docs/evidence/mercado-pago-production-deployment/provider-sandbox.json',
      'utf8',
    ),
  );
  const byStatus = Object.fromEntries(
    records.map((record) => [record.status, record]),
  );

  for (const status of [
    'INVALID_WEBHOOK_REJECTED',
    'REFUND_IDEMPOTENT',
    'WEBHOOK_REPLAY_CONVERGED',
  ]) {
    assert.equal(byStatus[status].exitResult, 0);
  }
  assert.equal(
    byStatus.INVALID_WEBHOOK_REJECTED.sanitizedReference,
    byStatus.WEBHOOK_REPLAY_CONVERGED.sanitizedReference,
  );
  assert.equal(
    byStatus.REFUND_IDEMPOTENT.sanitizedReference,
    byStatus.WEBHOOK_REPLAY_CONVERGED.sanitizedReference,
  );
});

test('AC-193: operational smoke evidence identifies the release and preserves rollback @spec:AC-193', async () => {
  const [deployment, smoke] = await Promise.all([
    readFile(
      'docs/evidence/mercado-pago-production-deployment/deployment.json',
      'utf8',
    ).then(JSON.parse),
    readFile(
      'docs/evidence/mercado-pago-production-deployment/smoke-test.md',
      'utf8',
    ),
  ]);

  assert.equal(deployment.stage, 'sandbox');
  assert.equal(deployment.result, 'validated');
  assert.match(deployment.gitRevision, /^[a-f0-9]{40}$/);
  assert.match(
    deployment.endpoint,
    /^https:\/\/[^/]+\.execute-api\.us-east-1\.amazonaws\.com$/,
  );
  assert.equal(deployment.services.length, 7);
  assert.match(smoke, new RegExp(deployment.gitRevision));
  for (const result of [
    /Public API health: HTTP 200/,
    /Authenticated GraphQL request: HTTP 200/,
    /Anonymous GraphQL request: HTTP 401/,
    /Anonymous MCP initialization: HTTP 401/,
    /Signed webhook replay: HTTP 200 twice/,
    /desired 1, running 1, and pending 0/,
    /git switch --detach "\$LAST_APPROVED_GIT_REV"/,
    /corepack pnpm run review/,
    /corepack pnpm run deploy/,
  ]) {
    assert.match(smoke, result);
  }
  assert.doesNotMatch(smoke, /(?:APP_USR|TEST)-[A-Za-z0-9_-]+/);
});

test('AC-062: invalid deployed MCP authentication is rejected with a challenge @spec:AC-062', async () => {
  const [journey, smoke] = await Promise.all([
    readFile('apps/e2e/src/journey.ts', 'utf8'),
    readFile(
      'docs/evidence/mercado-pago-production-deployment/smoke-test.md',
      'utf8',
    ),
  ]);

  assert.match(journey, /\[GATEWAY_AUDIENCE\][\s\S]*invalidAudience/);
  assert.match(journey, /headers\.has\('www-authenticate'\)/);
  assert.match(
    smoke,
    /Invalid-audience MCP initialization: HTTP 401 with a `WWW-Authenticate` challenge/,
  );
});

test('AC-063: deployed MCP tool scopes are enforced @spec:AC-063', async () => {
  const [journey, mcpConfig, smoke] = await Promise.all([
    readFile('apps/e2e/src/journey.ts', 'utf8'),
    readFile('apps/apollo-mcp/mcp.yaml', 'utf8'),
    readFile(
      'docs/evidence/mercado-pago-production-deployment/smoke-test.md',
      'utf8',
    ),
  ]);

  assert.match(journey, /\['mcp:tools'\][\s\S]*underScopedResponse/);
  assert.match(
    mcpConfig,
    /required_scopes:\n    me:\n      - marketplace:read/,
  );
  assert.match(smoke, /Under-scoped MCP `me`: HTTP 403/);
});

test('AC-064: the unchanged multi-resource bearer reaches Gateway through MCP @spec:AC-064', async () => {
  const [journey, mcpConfig, smoke] = await Promise.all([
    readFile('apps/e2e/src/journey.ts', 'utf8'),
    readFile('apps/apollo-mcp/mcp.yaml', 'utf8'),
    readFile(
      'docs/evidence/mercado-pago-production-deployment/smoke-test.md',
      'utf8',
    ),
  ]);

  assert.match(
    journey,
    /graphql\([\s\S]*grant\.accessToken[\s\S]*invokeMe\(environment, grant\.accessToken\)/,
  );
  assert.match(mcpConfig, /disable_auth_token_passthrough: false/);
  assert.match(
    smoke,
    /Authenticated MCP `me` with the same multi-resource bearer: HTTP 200 with the same buyer as GraphQL/,
  );
});

test('AC-196: the deployed MCP accepts the same redacted multi-resource bearer @spec:AC-196', async () => {
  const [project, bearer, smoke] = await Promise.all([
    readFile('apps/e2e/project.json', 'utf8').then(JSON.parse),
    readFile('apps/e2e/src/sandbox-bearer.ts', 'utf8'),
    readFile(
      'docs/evidence/mercado-pago-production-deployment/smoke-test.md',
      'utf8',
    ),
  ]);

  assert.equal(project.targets['mercado-pago-sandbox-mcp'].cache, false);
  assert.match(
    project.targets['mercado-pago-sandbox-mcp'].options.command,
    /^MERCADO_PAGO_SANDBOX_MCP_PROOF=1 /,
  );
  assert.match(bearer, /proof\.gatewayStatus !== 200/);
  assert.match(bearer, /proof\.mcpStatus !== 200/);
  assert.match(bearer, /proof\.invalidAudienceStatus !== 401/);
  assert.match(bearer, /proof\.underScopedStatus !== 403/);
  assert.doesNotMatch(smoke, /Bearer [A-Za-z0-9._~-]+/);
});

test('AC-191: infrastructure fails closed and contains the complete runtime @spec:AC-191', async () => {
  const config = await readFile('infra/sst.config.ts', 'utf8');
  const applications = [
    ['ApolloMcp', 'apps/apollo-mcp/Dockerfile'],
    ['Gateway', 'apps/gateway/Dockerfile'],
    ['IdentitySubgraph', 'apps/identity-subgraph/Dockerfile'],
    ['OrderWorkflowSubgraph', 'apps/order-workflow-subgraph/Dockerfile'],
    ['PaymentFederation', 'apps/payment-federation/Dockerfile'],
  ];

  for (const [name, dockerfilePath] of applications) {
    assert.match(
      config,
      new RegExp(`new sst\\.aws\\.Service\\(['"]${name}['"]`),
    );
    assert.match(config, new RegExp(`dockerfile: ['"]${dockerfilePath}['"]`));
    assert.match(await readFile(dockerfilePath, 'utf8'), /^HEALTHCHECK /m);
  }

  for (const database of [
    'IdentityDatabase',
    'OrderWorkflowDatabase',
    'PaymentDatabase',
  ]) {
    assert.match(
      config,
      new RegExp(
        `new sst\\.aws\\.(?:Aurora|Postgres)\\(\\s*['"]${database}['"]`,
      ),
    );
  }
  assert.match(config, /new sst\.aws\.Aurora\(['"]WordPressDatabase['"]/);
  assert.match(config, /new sst\.aws\.Service\(['"]RabbitMq['"]/);
  assert.match(config, /new sst\.aws\.Service\(['"]WordPress['"]/);

  assert.match(
    config,
    /new sst\.Secret\(\s*['"]MercadoPagoAccessToken['"]\s*,?\s*\)/,
  );
  assert.match(
    config,
    /new sst\.Secret\(\s*['"]MercadoPagoWebhookSecret['"]\s*,?\s*\)/,
  );
  assert.match(config, /PAYMENT_PROVIDER_MODE: ['"]mercado-pago['"]/);
  assert.match(
    config,
    /MERCADO_PAGO_ACCESS_TOKEN: mercadoPagoAccessToken\.value/,
  );
  assert.match(
    config,
    /MERCADO_PAGO_WEBHOOK_SECRET: mercadoPagoWebhookSecret\.value/,
  );
  assert.match(
    config,
    /MERCADO_PAGO_API_BASE_URL: ['"]https:\/\/api\.mercadopago\.com['"]/,
  );
  assert.match(config, /GATEWAY_GRAPHQL_URL:.*serviceHost\(['"]Gateway['"]/);
  assert.match(config, /IDENTITY_OAUTH_URL: publicOAuthIssuer/);
  assert.match(
    config,
    /entrypoint: \[['"]\/bin\/busybox['"], ['"]sh['"], ['"]-ec['"]\]/,
  );
  assert.match(config, /\/actuator\/health/);
  assert.ok((config.match(/health: \{/g) ?? []).length >= applications.length);

  assert.doesNotMatch(config, /loadBalancer:/);
  assert.match(
    config,
    /routePrivate\(\s*['"]POST \/webhooks\/mercado-pago['"]/,
  );
  assert.match(config, /routePrivate\(\s*['"]GET \/oauth\/clients['"]/);
  assert.doesNotMatch(
    config,
    /MERCADO_PAGO_(?:ACCESS_TOKEN|WEBHOOK_SECRET): ['"][^'"$]+['"]/,
  );
});

test('AC-191: production WordPress is immutable and secret-backed @spec:AC-191', async () => {
  const [stack, dockerfile, entrypoint] = await Promise.all([
    readFile('infra/sst.config.ts', 'utf8'),
    readFile('apps/wordpress-integration/Dockerfile', 'utf8'),
    readFile(
      'apps/wordpress-integration/scripts/production-entrypoint.sh',
      'utf8',
    ),
  ]);

  assert.match(stack, /dockerfile: 'apps\/wordpress-integration\/Dockerfile'/);
  assert.match(stack, /IdentitySeedAdminPassword/);
  assert.match(stack, /WordPressAdminPassword/);
  assert.match(stack, /\.marketplace-ready/);
  assert.match(stack, /Origin: \$WORDPRESS_URL/);
  assert.match(dockerfile, /woocommerce\.10\.4\.3\.zip/);
  assert.match(dockerfile, /wp-graphql\.2\.20\.0\.zip/);
  assert.match(entrypoint, /core install/);
  assert.doesNotMatch(entrypoint, /woocommerce_api_keys|WOO_CONSUMER/);
  assert.match(entrypoint, /wpgraphql_login_access_control/);
  assert.match(entrypoint, /shouldBlockUnauthorizedDomains/);
  assert.match(entrypoint, /user get payment-federation/);
  assert.match(entrypoint, /better_auth_user_id payment-federation/);
  assert.match(entrypoint, /better_auth_user_id order-workflow/);
});

test('AC-192: deployment is reviewed before provisioning @spec:AC-192', async () => {
  const [infraPackage, runbook, environmentTemplate, gitignore] =
    await Promise.all([
      readFile('infra/package.json', 'utf8').then(JSON.parse),
      readFile('docs/runbooks/deployment.md', 'utf8'),
      readFile('.env.example', 'utf8'),
      readFile('.gitignore', 'utf8'),
    ]);

  assert.match(gitignore, /^\.env$/m);
  assert.match(gitignore, /^\.env\.\*$/m);
  assert.match(gitignore, /^!\.env\.example$/m);
  assert.match(environmentTemplate, /^AWS_PROFILE=kaio-silva$/m);
  assert.match(environmentTemplate, /^SST_STAGE=sandbox$/m);
  assert.match(environmentTemplate, /^MERCADO_PAGO_ACCESS_TOKEN=$/m);
  assert.doesNotMatch(environmentTemplate, /APP_USR-|TEST-/);

  const review = infraPackage.scripts.review;
  const firstDeploy = infraPackage.scripts['deploy:first'];
  const deploy = infraPackage.scripts.deploy;
  assert.match(review, /sst diff --stage/);
  assert.match(review, /Permalink\/d/);
  assert.match(review, /LC_ALL=C sort/);
  assert.match(review, /sha256sum/);
  assert.match(deploy, /SST_DEPLOY_APPROVAL/);
  assert.match(deploy, /SST_APPROVED_STAGE/);
  assert.match(deploy, /SST_APPROVED_DIFF_SHA256/);
  assert.match(deploy, /SST_APPROVED_MONTHLY_COST_USD/);
  assert.match(deploy, /pnpm run validate/);
  assert.match(deploy, /sst diff --stage/);
  assert.match(deploy, /sha256sum/);
  assert.match(deploy, /Permalink\/d/);
  assert.match(deploy, /LC_ALL=C sort/);
  assert.match(deploy, /sst deploy --stage/);
  assert.ok(deploy.indexOf('pnpm run validate') < deploy.indexOf('sst diff'));
  assert.ok(deploy.indexOf('sst diff') < deploy.indexOf('sst deploy'));
  assert.match(firstDeploy, /SST_FIRST_DEPLOY_APPROVAL/);
  assert.match(firstDeploy, /SST_APPROVED_GIT_REV/);
  assert.match(firstDeploy, /git status --porcelain/);
  assert.match(firstDeploy, /git rev-parse HEAD/);
  assert.match(firstDeploy, /Stage not found/);
  assert.match(firstDeploy, /pnpm run validate/);
  assert.match(firstDeploy, /sst deploy --stage/);

  const { spawnSync } = await import('node:child_process');
  for (const environment of [
    { SST_STAGE: 'sandbox' },
    {
      SST_APPROVED_DIFF_SHA256: '0'.repeat(64),
      SST_APPROVED_MONTHLY_COST_USD: '100',
      SST_APPROVED_STAGE: 'production',
      SST_DEPLOY_APPROVAL: 'DEPLOY',
      SST_STAGE: 'production',
    },
  ]) {
    const attempt = spawnSync('bash', ['-o', 'pipefail', '-c', deploy], {
      env: { PATH: process.env.PATH, ...environment },
    });
    assert.notEqual(attempt.status, 0);
    assert.doesNotMatch(attempt.stderr.toString(), /sst:/);
  }

  const { chmod, mkdtemp, rm, writeFile } = await import('node:fs/promises');
  const { createHash } = await import('node:crypto');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const fakeBin = await mkdtemp(join(tmpdir(), 'sst-deploy-guard-'));
  const fakeLog = join(fakeBin, 'commands.log');
  await Promise.all([
    writeFile(
      join(fakeBin, 'pnpm'),
      '#!/bin/sh\nprintf "pnpm %s\\n" "$*" >> "$FAKE_LOG"\n',
      { mode: 0o755 },
    ),
    writeFile(
      join(fakeBin, 'sst'),
      '#!/bin/sh\nprintf "sst %s\\n" "$*" >> "$FAKE_LOG"\n[ "$1" != diff ] || printf "reviewed diff\\n"\n',
      { mode: 0o755 },
    ),
  ]);
  await Promise.all([
    chmod(join(fakeBin, 'pnpm'), 0o755),
    chmod(join(fakeBin, 'sst'), 0o755),
  ]);

  const reviewedHash = createHash('sha256')
    .update('reviewed diff\n')
    .digest('hex');
  const approvedEnvironment = {
    FAKE_LOG: fakeLog,
    PATH: `${fakeBin}:${process.env.PATH}`,
    SST_APPROVED_MONTHLY_COST_USD: '100',
    SST_APPROVED_STAGE: 'sandbox',
    SST_DEPLOY_APPROVAL: 'DEPLOY',
    SST_STAGE: 'sandbox',
  };

  try {
    const mismatch = spawnSync('bash', ['-o', 'pipefail', '-c', deploy], {
      env: { ...approvedEnvironment, SST_APPROVED_DIFF_SHA256: '0'.repeat(64) },
    });
    assert.notEqual(mismatch.status, 0);
    assert.doesNotMatch(await readFile(fakeLog, 'utf8'), /sst deploy/);

    const approved = spawnSync('bash', ['-o', 'pipefail', '-c', deploy], {
      env: { ...approvedEnvironment, SST_APPROVED_DIFF_SHA256: reviewedHash },
    });
    assert.equal(approved.status, 0, approved.stderr.toString());
    assert.match(
      await readFile(fakeLog, 'utf8'),
      /pnpm run validate[\s\S]*sst diff --stage sandbox[\s\S]*sst deploy --stage sandbox/,
    );

    await Promise.all([
      writeFile(
        join(fakeBin, 'git'),
        '#!/bin/sh\n[ "$1" = status ] && exit 0\n[ "$1 $2" = "rev-parse HEAD" ] && printf "approved-revision\\n"\n',
        { mode: 0o755 },
      ),
      writeFile(
        join(fakeBin, 'sst'),
        '#!/bin/sh\nprintf "sst %s\\n" "$*" >> "$FAKE_LOG"\n[ "$1" != diff ] || { printf "Stage not found\\n" >&2; exit 1; }\n',
        { mode: 0o755 },
      ),
    ]);
    await Promise.all([
      chmod(join(fakeBin, 'git'), 0o755),
      chmod(join(fakeBin, 'sst'), 0o755),
    ]);
    const firstApproved = spawnSync(
      'bash',
      ['-o', 'pipefail', '-c', firstDeploy],
      {
        env: {
          ...approvedEnvironment,
          SST_APPROVED_GIT_REV: 'approved-revision',
          SST_FIRST_DEPLOY_APPROVAL: 'CREATE',
        },
      },
    );
    assert.equal(firstApproved.status, 0, firstApproved.stderr.toString());
    assert.match(
      await readFile(fakeLog, 'utf8'),
      /pnpm run validate[\s\S]*sst diff --stage sandbox[\s\S]*sst deploy --stage sandbox/,
    );
  } finally {
    await rm(fakeBin, { force: true, recursive: true });
  }

  for (const item of [
    'exact stage',
    'SHA-256',
    'estimated monthly cost',
    'public endpoints',
    'secret bindings',
    'explicit approval',
  ]) {
    assert.match(runbook, new RegExp(item, 'i'));
  }
  assert.match(runbook, /sandbox/);
  assert.match(runbook, /must not be `production`/);
  assert.doesNotMatch(
    runbook,
    /MERCADO_PAGO_(?:ACCESS_TOKEN|WEBHOOK_SECRET)=\S+/,
  );
});

test('AC-195: one managed HTTPS API exposes only approved private routes @spec:AC-195', async () => {
  const [stack, mcpConfig] = await Promise.all([
    readFile('infra/sst.config.ts', 'utf8'),
    readFile('apps/apollo-mcp/mcp.yaml', 'utf8'),
  ]);

  assert.equal((stack.match(/new sst\.aws\.ApiGatewayV2\(/g) ?? []).length, 1);
  assert.match(
    stack,
    /nat: \{ type: ['"]ec2['"], ec2: \{ instance: ['"]t4g\.micro['"] \} \}/,
  );
  assert.match(
    stack,
    /new sst\.aws\.ApiGatewayV2\(['"]PublicApi['"], \{ vpc \}\)/,
  );
  assert.doesNotMatch(stack, /loadBalancer:/);
  for (const route of [
    'ANY /api/auth',
    'ANY /api/auth/{proxy+}',
    'POST /webhooks/mercado-pago',
    'ANY /mcp',
    'ANY /mcp/{proxy+}',
    'GET /health',
    '$default',
  ]) {
    assert.match(
      stack,
      new RegExp(
        `routePrivate\\(\\s*['"]${route.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`,
      ),
    );
  }
  assert.match(stack, /PUBLIC_API_HOST: publicApi\.url\.apply/);
  assert.match(mcpConfig, /- public-api\.invalid/);
});

test('AC-193: deployed containers use production-safe startup dependencies @spec:AC-193', async () => {
  const [stack, compose, mcpImage, wordpressEntrypoint, orm, relay, identity] =
    await Promise.all([
      readFile('infra/sst.config.ts', 'utf8'),
      readFile('compose.yaml', 'utf8'),
      readFile('apps/apollo-mcp/Dockerfile', 'utf8'),
      readFile(
        'apps/wordpress-integration/scripts/production-entrypoint.sh',
        'utf8',
      ),
      readFile(
        'apps/order-workflow-subgraph/src/persistence/mikro-orm.config.ts',
        'utf8',
      ),
      readFile(
        'apps/order-workflow-subgraph/src/order-events/postgres/postgres-order-event.relay.ts',
        'utf8',
      ),
      readFile(
        'libs/identity/nest/src/better-auth/better-auth.factory.ts',
        'utf8',
      ),
    ]);

  assert.match(
    mcpImage,
    /COPY --from=healthcheck \/bin\/busybox \/bin\/busybox/,
  );
  assert.match(
    mcpImage,
    /USER 0:0[\s\S]*RUN \["\/bin\/busybox", "ln"[\s\S]*USER 1000:1000/,
  );
  assert.match(wordpressEntrypoint, /-f \/var\/www\/html\/wp-config\.php/);
  assert.match(wordpressEntrypoint, /option update woocommerce_currency BRL/);
  assert.match(compose, /wp option update woocommerce_currency BRL/);
  assert.match(stack, /gosu rabbitmq rabbitmq-diagnostics -q ping/);
  assert.match(stack, /\/bin\/busybox cp \/data\/mcp\.yaml \/tmp\/mcp\.yaml/);
  assert.match(stack, /\/bin\/busybox sed -i[\s\S]*\/tmp\/mcp\.yaml/);
  assert.match(
    stack,
    /image: \(_args, options\)[\s\S]*options\.retainOnDelete = true/,
  );
  assert.match(
    orm,
    /ORDER_WORKFLOW_DB_SSL !== 'false'[\s\S]*connection: \{ ssl: \{ rejectUnauthorized: false \} \}/,
  );
  assert.match(relay, /ORDER_WORKFLOW_DB_SSL !== 'false'/);
  assert.match(identity, /DATABASE_SSL !== 'false'/);
  assert.match(identity, /IDENTITY_TRUSTED_ORIGINS\?\.split\(','\)/);
  assert.match(compose, /DATABASE_SSL: 'false'/);
  assert.match(
    compose,
    /IDENTITY_TRUSTED_ORIGINS: http:\/\/127\.0\.0\.1:\*,http:\/\/localhost:\*/,
  );
  assert.match(compose, /ORDER_WORKFLOW_DB_SSL: 'false'/);
});
