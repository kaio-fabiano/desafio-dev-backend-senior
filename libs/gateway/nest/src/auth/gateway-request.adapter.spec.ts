import { describe, expect, it } from 'vitest';

import {
  toGatewayRequest,
  trustedGatewayOrigin,
} from './gateway-request.adapter.ts';

const origin = 'https://gateway.marketplace.local';

function input(target: string) {
  return {
    headers: { host: 'attacker.example' },
    method: 'POST',
    rawHeaders: ['host', 'attacker.example'],
    url: target,
  };
}

describe('gateway request adapter', () => {
  it('keeps the configured origin and repeated raw headers', () => {
    const request = toGatewayRequest(
      {
        ...input('/graphql?operation=Cart'),
        rawHeaders: ['x-value', 'one', 'x-value', 'two'],
      },
      origin,
    );

    expect(request.url).toBe(`${origin}/graphql?operation=Cart`);
    expect(request.headers.get('x-value')).toBe('one, two');
  });

  it('defaults missing request targets and methods without inventing headers', () => {
    const request = toGatewayRequest(
      {
        headers: {},
        rawHeaders: ['', 'ignored', 'orphan'],
      } as never,
      origin,
    );

    expect(request.url).toBe(`${origin}/`);
    expect(request.method).toBe('GET');
    expect([...request.headers]).toEqual([]);
  });

  it('rejects absolute, network-path, and backslash origin overrides', () => {
    for (const target of [
      'https://attacker.example/graphql',
      '//attacker.example/graphql',
      '/\\attacker.example/graphql',
    ]) {
      expect(() => toGatewayRequest(input(target), origin)).toThrow(
        'Gateway request target must be an absolute path',
      );
    }
  });

  it('accepts only HTTP gateway origins', () => {
    expect(trustedGatewayOrigin(`${origin}/nested`)).toBe(origin);
    expect(() => trustedGatewayOrigin('ftp://gateway.example')).toThrow(
      'Gateway origin must use HTTP or HTTPS',
    );
    expect(() => trustedGatewayOrigin('gateway')).toThrow();
  });
});
