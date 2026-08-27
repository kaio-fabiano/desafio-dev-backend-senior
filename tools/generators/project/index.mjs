import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

const [name, scope, type = 'lib'] = process.argv.slice(2);
if (!name || !scope || !['gateway', 'identity', 'commerce', 'contract', 'shared'].includes(scope)) {
  throw new Error('Usage: node tools/generators/project/index.mjs <name> <scope> [app|lib]');
}
const root = join(type === 'app' ? 'apps' : 'libs', name);
const project = { name: `@desafio-dev-backend-senior/${name}`, projectType: type === 'app' ? 'application' : 'library', sourceRoot: `${root}/src`, tags: [`type:${type}`, `scope:${scope}`] };
await mkdir(dirname(join(root, 'project.json')), { recursive: true });
await writeFile(join(root, 'project.json'), `${JSON.stringify(project, null, 2)}\n`);
