import { chmod, readFile, rename, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

import { issueSandboxBearer } from './journey.ts';

const BEARER_NAME = 'MERCADO_PAGO_SANDBOX_BEARER_TOKEN';
const REQUIRED_SCOPES = ['cart:write', 'orders:read'];

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

async function main() {
  const identityUrl = process.argv[2];
  const environmentPath = process.argv[3] ?? '.env';
  if (!identityUrl?.startsWith('http://127.0.0.1:')) {
    throw new Error('Expected the local Identity URL as the first argument');
  }
  const grant = await issueSandboxBearer(identityUrl);
  validateSandboxClaims(grant.claims);
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
