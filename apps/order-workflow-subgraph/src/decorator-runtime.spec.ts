import 'reflect-metadata';

import { PATH_METADATA } from '@nestjs/common/constants';
import { describe, expect, it } from 'vitest';

import { HealthController } from './health.controller.ts';

describe('Order workflow decorator runtime', () => {
  it('loads Nest decorator syntax and metadata @spec:AC-225', () => {
    expect(Reflect.getMetadata(PATH_METADATA, HealthController)).toBe('/');
  });
});
