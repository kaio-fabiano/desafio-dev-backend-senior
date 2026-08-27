import { pathToFileURL } from 'node:url';

import {
  GATEWAY_AUDIENCE,
  MCP_AUDIENCE,
  REQUIRED_SCOPE,
  startAuthServer,
} from './auth-server.ts';
import { validateAtGateway, validateAtMcp } from './auth-resource-servers.ts';

type Rejection = {
  accepted: false;
  resource: 'gateway' | 'mcp';
};

async function expectAudienceRejection(
  verification: Promise<unknown>,
  resource: Rejection['resource'],
): Promise<Rejection> {
  try {
    await verification;
  } catch {
    return { accepted: false, resource };
  }
  throw new Error(`${resource} accepted a token without its audience`);
}

export async function runMultiResourceProbe() {
  const auth = await startAuthServer();
  try {
    const sharedToken = await auth.issueToken([GATEWAY_AUDIENCE, MCP_AUDIENCE]);
    const [gateway, mcp] = await Promise.all([
      validateAtGateway(sharedToken, auth.issuer, auth.jwksUrl),
      validateAtMcp(sharedToken, auth.issuer, auth.jwksUrl),
    ]);

    const gatewayOnlyToken = await auth.issueToken([GATEWAY_AUDIENCE]);
    const mcpOnlyToken = await auth.issueToken([MCP_AUDIENCE]);
    await Promise.all([
      validateAtGateway(gatewayOnlyToken, auth.issuer, auth.jwksUrl),
      validateAtMcp(mcpOnlyToken, auth.issuer, auth.jwksUrl),
    ]);
    const rejected = await Promise.all([
      expectAudienceRejection(
        validateAtMcp(gatewayOnlyToken, auth.issuer, auth.jwksUrl),
        'mcp',
      ),
      expectAudienceRejection(
        validateAtGateway(mcpOnlyToken, auth.issuer, auth.jwksUrl),
        'gateway',
      ),
    ]);

    return {
      issuer: auth.issuer,
      requiredScope: REQUIRED_SCOPE,
      expectedAudiences: [GATEWAY_AUDIENCE, MCP_AUDIENCE],
      accepted: { gateway, mcp },
      rejected,
    };
  } finally {
    await auth.close();
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  console.log(JSON.stringify(await runMultiResourceProbe(), null, 2));
}
