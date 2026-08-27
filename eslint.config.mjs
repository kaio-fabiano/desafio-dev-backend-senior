import nxPlugin from '@nx/eslint-plugin';

export default [
  {
    ignores: ['node_modules/**', 'dist/**', 'coverage/**'],
  },
  ...nxPlugin.configs['flat/base'],
  {
    files: ['**/*.{js,mjs,cjs,ts,mts,cts}'],
    rules: {
      '@nx/enforce-module-boundaries': [
        'error',
        {
          enforceBuildableLibDependency: true,
          allow: [],
          depConstraints: [
            { sourceTag: 'scope:gateway', onlyDependOnLibsWithTags: ['scope:shared', 'scope:contract'] },
            { sourceTag: 'scope:identity', onlyDependOnLibsWithTags: ['scope:identity', 'scope:shared', 'scope:contract'] },
            { sourceTag: 'scope:commerce', onlyDependOnLibsWithTags: ['scope:commerce', 'scope:shared', 'scope:contract'] },
            { sourceTag: 'scope:contract', onlyDependOnLibsWithTags: ['scope:contract', 'scope:shared'] },
            { sourceTag: 'scope:shared', onlyDependOnLibsWithTags: ['scope:shared'] },
          ],
        },
      ],
    },
  },
];
