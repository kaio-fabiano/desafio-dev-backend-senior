import nxPlugin from '@nx/eslint-plugin';

export default [
  {
    ignores: ['node_modules/**', 'dist/**', 'coverage/**'],
  },
  ...nxPlugin.configs['flat/base'],
  ...nxPlugin.configs['flat/typescript'],
  ...nxPlugin.configs['flat/javascript'],
  {
    files: ['**/*.{js,mjs,cjs,ts,mts,cts}'],
    rules: {
      '@nx/enforce-module-boundaries': [
        'error',
        {
          enforceBuildableLibDependency: true,
          allow: [],
          depConstraints: [
            { sourceTag: 'scope:gateway', onlyDependOnLibsWithTags: ['scope:gateway', 'scope:platform', 'scope:shared', 'scope:contract'] },
            { sourceTag: 'scope:identity', onlyDependOnLibsWithTags: ['scope:identity', 'scope:platform', 'scope:shared', 'scope:contract'] },
            { sourceTag: 'scope:wordpress', onlyDependOnLibsWithTags: ['scope:wordpress', 'scope:identity', 'scope:shared', 'scope:contract'] },
            { sourceTag: 'scope:order-workflow', onlyDependOnLibsWithTags: ['scope:order-workflow', 'scope:platform', 'scope:shared', 'scope:contract'] },
            { sourceTag: 'scope:contract', onlyDependOnLibsWithTags: ['scope:contract', 'scope:shared'] },
            { sourceTag: 'scope:shared', onlyDependOnLibsWithTags: ['scope:shared'] },
            { sourceTag: 'scope:platform', onlyDependOnLibsWithTags: ['scope:platform', 'scope:shared'] },
          ],
        },
      ],
    },
  },
];
