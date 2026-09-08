import { describe, expect, it, vi } from 'vitest';

import { GatewayAuthenticationRequest } from '../application/dto/gateway-authentication-request.dto.ts';
import { TokenVerifierService } from './token-verifier.service.ts';

describe('TokenVerifierService', () => {
  it('maps shared OAuth claims into the gateway principal', async () => {
    const verify = vi.fn().mockResolvedValue({
      audience: ['gateway', 'identity'],
      claims: { supplierCompanyId: 'supplier-1' },
      scopes: ['orders:read'],
      subject: 'buyer-1',
    });
    const service = new TokenVerifierService({ verify } as never);
    const request = new Request('https://gateway.example/graphql');

    await expect(service.verify(request)).resolves.toEqual({
      audience: ['gateway', 'identity'],
      scopes: ['orders:read'],
      subject: 'buyer-1',
      supplierCompanyId: 'supplier-1',
    });
    expect(verify).toHaveBeenCalledWith(request);
  });

  it('requires a keyed ES256 compact JWT before shared verification', async () => {
    const verify = vi.fn();
    const service = new TokenVerifierService({ verify } as never);
    const encoded = (value: unknown) =>
      Buffer.from(JSON.stringify(value)).toString('base64url');
    const request = (authorization: string) =>
      new Request('https://gateway.example/graphql', {
        headers: { authorization },
      });

    for (const authorization of [
      'Bearer opaque',
      'Bearer !!!.payload.signature',
      `Bearer ${encoded({ alg: 'ES256' })}.payload.signature`,
      `Bearer ${encoded({ alg: 'RS256', kid: 'key-1' })}.payload.signature`,
    ]) {
      await expect(service.verify(request(authorization))).rejects.toThrow();
    }
    expect(verify).not.toHaveBeenCalled();
  });

  it('omits malformed optional supplier claims and preserves failures', async () => {
    const verify = vi.fn().mockResolvedValue({
      audience: [],
      claims: { supplierCompanyId: 42 },
      scopes: [],
      subject: 'buyer-1',
    });
    const service = new TokenVerifierService({ verify } as never);

    await expect(
      service.verify(new Request('https://gateway.example/graphql')),
    ).resolves.toEqual({ audience: [], scopes: [], subject: 'buyer-1' });

    const outage = new Error('JWKS unavailable');
    verify.mockRejectedValueOnce(outage);
    await expect(
      service.verify(new Request('https://gateway.example/graphql')),
    ).rejects.toBe(outage);
  });

  it('preserves authorization and DPoP proof through the token port', async () => {
    const verify = vi.fn().mockResolvedValue({
      audience: ['gateway'],
      claims: {},
      scopes: [],
      subject: 'buyer-1',
    });
    const service = new TokenVerifierService({ verify } as never);
    const encoded = Buffer.from(
      JSON.stringify({ alg: 'ES256', kid: 'key-1' }),
    ).toString('base64url');

    await service.verifyToken(
      new GatewayAuthenticationRequest(
        `DPoP ${encoded}.payload.signature`,
        undefined,
        undefined,
        'signed-dpop-proof',
        'POST',
        'request-1',
        'https://gateway.example/graphql',
        undefined,
      ),
    );

    const request = verify.mock.calls[0]?.[0];
    expect(request.headers.get('authorization')).toMatch(/^DPoP /);
    expect(request.headers.get('dpop')).toBe('signed-dpop-proof');
  });
});
