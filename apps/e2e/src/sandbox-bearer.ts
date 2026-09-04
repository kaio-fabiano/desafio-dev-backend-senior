import { chmod, readFile, rename, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

import { issueSandboxBearer, proveSandboxMcpAccess } from './journey.ts';

const BEARER_NAME = 'MERCADO_PAGO_SANDBOX_BEARER_TOKEN';
const REQUIRED_AUDIENCES = [
  'https://gateway.marketplace.local',
  'https://mcp.marketplace.local',
];
const REQUIRED_SCOPES = ['cart:write', 'orders:read'];
const MCP_SCOPES = ['marketplace:read', 'mcp:tools'];

export function upsertEnvironmentValue(
  contents: string,
  name: string,
  value: string,
) {
  const line = `${name}=${value}`;
  const pattern = new RegExp(`^${name}=.*$`, 'm');
  return pattern.test(contents)
    ? contents.replace(pattern, line)
    : `${contents.trimEnd()}\n${line}\n`;
}

export function validateSandboxClaims(claims: Record<string, unknown>) {
  const scopes = new Set(
    (Array.isArray(claims.scope)
      ? claims.scope
      : String(claims.scope ?? '').split(' ')
    ).filter(
      (scope): scope is string => typeof scope === 'string' && scope.length > 0,
    ),
  );
  for (const scope of REQUIRED_SCOPES) {
    if (!scopes.has(scope)) throw new Error(`Issued token is missing ${scope}`);
  }
}

function validateSandboxMcpClaims(claims: Record<string, unknown>) {
  validateSandboxClaims(claims);
  const audiences = new Set(
    Array.isArray(claims.aud) ? claims.aud : [claims.aud],
  );
  for (const audience of REQUIRED_AUDIENCES) {
    if (!audiences.has(audience))
      throw new Error(`Issued token is missing ${audience}`);
  }
  const scopes = new Set(String(claims.scope ?? '').split(' '));
  for (const scope of MCP_SCOPES) {
    if (!scopes.has(scope)) throw new Error(`Issued token is missing ${scope}`);
  }
}

async function main() {
  const proofRequested = process.env.MERCADO_PAGO_SANDBOX_MCP_PROOF === '1';
  const configuredGraphqlUrl = process.env.MERCADO_PAGO_SANDBOX_GRAPHQL_URL;
  const publicApiUrl =
    process.argv[4] ??
    (proofRequested && configuredGraphqlUrl
      ? new URL(configuredGraphqlUrl).origin
      : undefined);
  const identityUrl = process.argv[2] ?? publicApiUrl;
  const environmentPath = process.argv[3] ?? '.env';
  if (!identityUrl || !isApprovedIdentityUrl(identityUrl)) {
    throw new Error(
      'Expected an HTTPS or loopback Identity URL as the first argument',
    );
  }
  const grant = await issueSandboxBearer(identityUrl);
  validateSandboxMcpClaims(grant.claims);
  if (proofRequested && !publicApiUrl)
    throw new Error('Expected the public API URL for the MCP proof');
  if (publicApiUrl) {
    if (!isApprovedIdentityUrl(publicApiUrl))
      throw new Error('Expected an HTTPS or loopback public API URL');
    const proof = await proveSandboxMcpAccess(identityUrl, publicApiUrl, grant);
    if (
      !proof.sameIdentity ||
      proof.gatewayStatus !== 200 ||
      proof.mcpStatus !== 200 ||
      proof.invalidAudienceStatus !== 401 ||
      !proof.invalidAudienceChallenge ||
      proof.underScopedStatus !== 403
    ) {
      throw new Error(`Sandbox MCP proof failed: ${JSON.stringify(proof)}`);
    }
    process.stdout.write(
      `Sandbox MCP proof passed: ${JSON.stringify(proof)}\n`,
    );
  }
  const contents = await readFile(environmentPath, 'utf8');
  const temporaryPath = `${environmentPath}.tmp`;
  await writeFile(
    temporaryPath,
    upsertEnvironmentValue(contents, BEARER_NAME, grant.accessToken),
    { mode: 0o600 },
  );
  await rename(temporaryPath, environmentPath);
  await chmod(environmentPath, 0o600);
  process.stdout.write(
    'Sandbox bearer generated and stored without disclosure.\n',
  );
}

export function isApprovedIdentityUrl(value: string) {
  const url = new URL(value);
  return url.protocol === 'https:' || url.hostname === '127.0.0.1';
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch((error) => {
    process.stderr.write(
      `${error instanceof Error ? error.message : 'Bearer generation failed'}\n`,
    );
    process.exitCode = 1;
  });
}
