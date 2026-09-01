import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const graph = JSON.parse(readFileSync('graphify-out/graph.json', 'utf8'));
const builtAt = graph.built_at_commit;

if (!/^[0-9a-f]{40}$/.test(builtAt ?? '')) {
  throw new Error('graphify-out/graph.json has no valid built_at_commit');
}

const changed = execFileSync(
  'git',
  ['diff', '--name-only', `${builtAt}..HEAD`, '--', '.', ':(exclude)graphify-out'],
  { encoding: 'utf8' },
)
  .trim()
  .split('\n')
  .filter(Boolean);

if (changed.length) {
  throw new Error(
    `Graphify is stale. Run graphify --update after commit ${builtAt.slice(0, 7)}.\n${changed.join('\n')}`,
  );
}

console.log(`Graphify is current at ${builtAt.slice(0, 7)}.`);
