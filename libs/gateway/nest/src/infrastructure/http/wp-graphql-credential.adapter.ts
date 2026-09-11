import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { GatewayErrorMessages } from '../../application/gateway-error-messages.ts';
import { WordPressCredentialPort } from '../../application/ports/wordpress-credential.port.ts';

@Injectable()
export class WpGraphqlCredentialAdapter extends WordPressCredentialPort {
  private readonly endpoint: URL;
  private readonly siteToken: string;

  constructor(@Inject(ConfigService) config: ConfigService) {
    super();
    this.endpoint = new URL(
      config.get<string>('WORDPRESS_GRAPHQL_URL', 'http://wordpress/graphql'),
    );
    this.siteToken = config.get<string>('WPGRAPHQL_SITE_TOKEN', '');
  }

  async exchange(subject: string): Promise<string> {
    if (!this.siteToken) {
      throw new Error(GatewayErrorMessages.wordpressCredentialExchangeFailed);
    }
    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: this.endpoint.origin,
        'x-wpgraphql-site-token': this.siteToken,
      },
      body: JSON.stringify({
        query: `
          mutation LoginGatewayWordPressUser($input: LoginInput!) {
            login(input: $input) { authToken }
          }
        `,
        variables: { input: { identity: subject, provider: 'SITETOKEN' } },
      }),
    });
    if (!response.ok) {
      throw new Error(GatewayErrorMessages.wordpressCredentialExchangeFailed);
    }
    const result = (await response.json()) as {
      data?: { login?: { authToken?: string } };
      errors?: readonly unknown[];
    };
    const credential = result.data?.login?.authToken?.trim();
    if (result.errors?.length || !credential) {
      throw new Error(GatewayErrorMessages.wordpressCredentialExchangeFailed);
    }
    return credential;
  }
}
