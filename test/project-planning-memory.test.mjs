import { readFile, stat } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { test } from 'node:test';

const read = (path) => readFile(path, 'utf8');

const cases = [
  ['@spec:AC-001 index tracks requirements, deliverables, and risks', async () => {
    const index = await read('docs/prds/README.md');
    assert.match(index, /Requirement → PRD → proof matrix/);
    assert.match(index, /Deliverables that must not disappear from the plan/);
    assert.match(index, /riscos-e-decisoes-pendentes/);
  }],
  ['@spec:AC-002 capabilities are separated into PRDs', async () => {
    const files = [
      '01-arquitetura-e-dominio.md',
      '02-graphql-federation.md',
      '03-identidade-e-oauth.md',
      '04-commerce-saga-e-realtime.md',
      '05-apollo-mcp.md',
      '06-plataforma-qualidade-e-entrega.md',
      '07-roadmap.md',
    ];
    await Promise.all(files.map((file) => stat(`docs/prds/${file}`)));
  }],
  ['@spec:AC-003 federation has an operational guide', async () => {
    const federation = await read('docs/prds/02-graphql-federation.md');
    for (const term of ['schema-first', '@key', 'Rover', 'Relay', 'DataLoader', 'per request']) {
      assert.ok(federation.includes(term), `missing term: ${term}`);
    }
    assert.match(federation, /relay\.dev\/graphql\/connections\.htm/);
    assert.match(federation, /Manuel-Antunes\/wp-graphql-federations/);
    assert.match(federation, /plugin-first/);
  }],
  ['@spec:AC-004 critical risks are explicit', async () => {
    const risks = await read('docs/prds/08-riscos-e-decisoes-pendentes.md');
    for (const term of ['graphql-sse', 'multipart', 'audience', 'WordPress', '08/07/2026']) {
      assert.ok(risks.includes(term), `missing risk: ${term}`);
    }
  }],
  ['@spec:AC-005 sources include their origin and consultation date', async () => {
    const sources = await read('docs/prds/fontes.md');
    assert.match(sources, /Consulted on 2026-08-25/);
    assert.match(sources, /apollographql\.com/);
    assert.match(sources, /better-auth\.com/);
    assert.match(sources, /rabbitmq\.com/);
    assert.match(sources, /graphql\.org\/learn\/federation/);
    assert.match(sources, /relay\.dev\/graphql\/connections\.htm/);
    assert.match(sources, /Manuel-Antunes\/wp-graphql-federations/);
  }],
  ['@spec:AC-006 memory is navigable in Obsidian and Graphify', async () => {
    const map = await read('docs/knowledge/Mapa do Projeto.md');
    const federation = await read('docs/knowledge/GraphQL Federation.md');
    const interview = await read('docs/knowledge/Notas da Entrevista.md');
    assert.match(map, /\[\[GraphQL Federation\]\]/);
    assert.match(map, /\[\[Notas da Entrevista\]\]/);
    assert.match(federation, /\[\[Mapa do Projeto\]\]/);
    assert.match(interview, /do not recreate them/);
    assert.match(interview, /federated gateway/);
    await stat('graphify-out/graph.json');
    await stat('graphify-out/graph.html');
    await stat('graphify-out/obsidian/graph.canvas');
  }],
  ['@spec:AC-007 plan declares model and effort before execution', async () => {
    const config = JSON.parse(await read('onpspec.config.json'));
    assert.deepEqual(config.paralelo, {
      model: 'gpt-5.6-terra',
      esforco: 'medium',
      resumoModel: 'gpt-5.6-luna',
      sandbox: 'danger-full-access',
    });

    const instructions = await read('AGENTS.md');
    for (const term of [
      'gpt-5.6-luna',
      'gpt-5.6-terra',
      'gpt-5.6-sol',
      "user's explicit confirmation",
      'Every implementation task must declare `Modelo:` and `Esforço:`',
    ]) {
      assert.ok(instructions.includes(term), `missing policy: ${term}`);
    }
  }],
];

for (const [name, check] of cases) {
  test(name, check);
}
