import { Inject, Injectable } from '@nestjs/common';

import { IdentityErrorMessages } from '../application/errors/identity-error-messages.ts';
import { WordPressConfiguration } from './wordpress-configuration.provider.ts';
import { WordPressError } from './wordpress.error.ts';

@Injectable()
export class WordPressIdentityService {
  private readonly endpoint: URL;
  private readonly headers: Record<string, string>;

  constructor(
    @Inject(WordPressConfiguration)
    private readonly configuration: WordPressConfiguration,
  ) {
    this.endpoint = new URL('/graphql', configuration.endpoint);
    this.headers = {
      'content-type': 'application/json',
      origin: this.endpoint.origin,
      'x-wpgraphql-site-token': configuration.siteToken,
    };
  }

  async createCustomer(input: {
    email: string;
    name: string;
    password: string;
  }): Promise<{ id: string }> {
    const result = await this.graphql<{
      registerCustomer?: { customer?: { id?: string } };
    }>(
      `
        mutation RegisterIdentityCustomer($input: RegisterCustomerInput!) {
          registerCustomer(input: $input) { customer { id } }
        }
      `,
      {
        input: {
          authenticate: false,
          email: input.email,
          firstName: input.name,
          password: input.password,
          username: input.email,
        },
      },
    );
    if (result.errors?.length) {
      if (
        result.errors.some(({ message }) => /already registered/i.test(message))
      ) {
        throw new WordPressError(
          'WORDPRESS_IDENTITY_ALREADY_EXISTS',
          IdentityErrorMessages.wordpress.WORDPRESS_IDENTITY_ALREADY_EXISTS,
        );
      }
      throw new WordPressError(
        'WORDPRESS_CREATE_FAILED',
        IdentityErrorMessages.wordpress.WORDPRESS_CREATE_FAILED,
      );
    }
    const id = result.data?.registerCustomer?.customer?.id;
    if (!id) {
      throw new WordPressError(
        'WORDPRESS_CREATE_FAILED',
        IdentityErrorMessages.wordpress.WORDPRESS_CREATE_RETURNED_NO_CUSTOMER,
      );
    }
    return { id };
  }

  async deleteCustomer(wordpressUserId: string): Promise<void> {
    const authToken = await this.registrarToken('WORDPRESS_DELETE_FAILED');
    const result = await this.graphql<{ deleteUser?: { deletedId?: string } }>(
      `
        mutation DeleteIdentityCustomer($input: DeleteUserInput!) {
          deleteUser(input: $input) { deletedId }
        }
      `,
      { input: { id: wordpressUserId } },
      authToken,
    );
    if (
      result.errors?.length ||
      result.data?.deleteUser?.deletedId !== wordpressUserId
    ) {
      throw new WordPressError(
        'WORDPRESS_DELETE_FAILED',
        IdentityErrorMessages.wordpress.WORDPRESS_DELETE_FAILED,
      );
    }
  }

  async linkSubject(wordpressUserId: string, subject: string): Promise<void> {
    const authToken = await this.registrarToken('WORDPRESS_LINK_FAILED');
    const result = await this.graphql<{
      updateCustomer?: { customer?: { id?: string } };
    }>(
      `
        mutation LinkIdentitySubject($input: UpdateCustomerInput!) {
          updateCustomer(input: $input) { customer { id } }
        }
      `,
      {
        input: {
          id: wordpressUserId,
          metaData: [{ key: 'better_auth_user_id', value: subject }],
        },
      },
      authToken,
    );
    if (
      result.errors?.length ||
      result.data?.updateCustomer?.customer?.id !== wordpressUserId
    ) {
      throw new WordPressError(
        'WORDPRESS_LINK_FAILED',
        IdentityErrorMessages.wordpress.WORDPRESS_LINK_FAILED,
      );
    }
  }

  private async registrarToken(
    errorCode: 'WORDPRESS_DELETE_FAILED' | 'WORDPRESS_LINK_FAILED',
  ): Promise<string> {
    const result = await this.graphql<{ login?: { authToken?: string } }>(
      `
        mutation LoginIdentityRegistrar($input: LoginInput!) {
          login(input: $input) { authToken }
        }
      `,
      {
        input: {
          identity: this.configuration.registrarIdentity,
          provider: 'SITETOKEN',
        },
      },
    );
    const authToken = result.data?.login?.authToken;
    if (result.errors?.length || !authToken) {
      throw new WordPressError(
        errorCode,
        IdentityErrorMessages.wordpress.WORDPRESS_REGISTRAR_AUTHENTICATION_FAILED,
      );
    }
    return authToken;
  }

  private async graphql<T>(
    query: string,
    variables: Record<string, unknown>,
    authToken?: string,
  ): Promise<{
    data?: T;
    errors?: Array<{ message: string }>;
  }> {
    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        ...this.headers,
        ...(authToken ? { authorization: `Bearer ${authToken}` } : {}),
      },
      body: JSON.stringify({ query, variables }),
    });
    if (!response.ok) {
      return { errors: [{ message: `HTTP ${response.status}` }] };
    }
    return response.json() as Promise<{
      data?: T;
      errors?: Array<{ message: string }>;
    }>;
  }
}
