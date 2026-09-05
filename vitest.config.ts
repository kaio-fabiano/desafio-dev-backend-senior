import { defineConfig } from 'vitest/config';

const criticalThresholds = {
  branches: 95,
  functions: 100,
  lines: 100,
  statements: 100,
  perFile: true,
} as const;

export default defineConfig({
  test: {
    clearMocks: true,
    environment: 'node',
    include: ['libs/**/*.spec.ts'],
    restoreMocks: true,
    coverage: {
      provider: 'v8',
      include: [
        'libs/platform/nest/src/oauth-resource/graphql/*.ts',
        'libs/platform/nest/src/oauth-resource/verification/*.ts',
      ],
      reporter: ['text', 'json-summary', 'html'],
      excludeAfterRemap: true,
      thresholds: {
        branches: 85,
        functions: 90,
        lines: 90,
        statements: 90,
        perFile: true,
        'libs/**/src/{auth,oauth-resource}/**/*.ts': criticalThresholds,
        'libs/**/*{authorization,idempotency,ownership}*.ts':
          criticalThresholds,
      },
    },
  },
});
