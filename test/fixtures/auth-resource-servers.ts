import { oauthProviderResourceClient } from '@better-auth/oauth-provider/resource-client';
import { createAuthClient } from 'better-auth/client';

import {
  GATEWAY_AUDIENCE,
  MCP_AUDIENCE,
  REQUIRED_SCOPE,
} from './auth-server.ts';

export type AcceptedToken = {
  audience: string | string[];
  expiresAt: number;
  issuedAt: number;
  issuer: string;
  scope: string;
};

function createResourceServer(audience: string) {
  const client = createAuthClient({
    plugins: [oauthProviderResourceClient()],
  });

  return async (
    token: string,
    issuer: string,
    jwksUrl: string,
  ): Promise<AcceptedToken> => {
    const payload = await client.verifyAccessTokenRequest(
      new Request(audience, {
        headers: { authorization: `Bearer ${token}` },
      }),
      {
        jwksUrl,
        verifyOptions: { issuer, audience },
        requiredScopes: [REQUIRED_SCOPE],
      },
    );

    if (
      !payload.iss ||
      !payload.aud ||
      !payload.exp ||
      !payload.iat ||
      typeof payload.scope !== 'string'
    ) {
      throw new Error('Verified token is missing required OAuth claims');
    }
    return {
      audience: payload.aud,
      expiresAt: payload.exp,
      issuedAt: payload.iat,
      issuer: payload.iss,
      scope: payload.scope,
    };
  };
}

export const validateAtGateway = createResourceServer(GATEWAY_AUDIENCE);
export const validateAtMcp = createResourceServer(MCP_AUDIENCE);
