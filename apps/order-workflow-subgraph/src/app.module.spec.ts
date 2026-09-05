import { describe, expect, it } from 'vitest';

import { AppModule } from './app.module.ts';

describe('AppModule', () => {
  it('uses a transport-specific GraphQL module instead of a monolithic workflow module', () => {
    const imports = Reflect.getMetadata('imports', AppModule) as Array<{
      name?: string;
    }>;

    expect(imports.map((module) => module.name)).toContain(
      'OrderWorkflowGraphqlModule',
    );
    expect(imports.map((module) => module.name)).not.toContain(
      'OrderWorkflowModule',
    );
  });
});
