import { chmod, readFile, rename, writeFile } from 'node:fs/promises';

export function upsertEnvironmentValue(
  contents: string,
  name: string,
  value: string,
) {
  const line = `${name}=${value}`;
  const pattern = new RegExp(`^${name}=.*$`, 'm');
  if (pattern.test(contents)) return contents.replace(pattern, line);
  return `${contents ? `${contents.trimEnd()}\n` : ''}${line}\n`;
}

export async function storeSecretEnvironmentValue(
  path: string,
  name: string,
  value: string,
) {
  const temporaryPath = `${path}.${process.pid}.tmp`;
  await writeFile(
    temporaryPath,
    upsertEnvironmentValue(await readFile(path, 'utf8'), name, value),
    { mode: 0o600 },
  );
  await rename(temporaryPath, path);
  await chmod(path, 0o600);
}
