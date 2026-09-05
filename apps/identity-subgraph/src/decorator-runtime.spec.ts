import { PATH_METADATA } from '@nestjs/common/constants';
import { describe, expect, it } from 'vitest';

import { HealthController } from './health.controller.ts';

describe('Identity decorator runtime', () => {
  it('loads Nest controller metadata @spec:AC-225', () => {
    expect(Reflect.getMetadata(PATH_METADATA, HealthController)).toBe('/');
  });
});
