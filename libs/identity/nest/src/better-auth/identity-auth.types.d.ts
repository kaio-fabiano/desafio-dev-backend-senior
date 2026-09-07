import { betterAuth } from 'better-auth';
type BaseIdentityAuth = ReturnType<typeof betterAuth>;
type IdentityDatabase = NonNullable<Parameters<typeof betterAuth>[0]['database']>;
export type IdentityAuthOptions = { baseURL?: string; database?: IdentityDatabase; issuer?: string; secret?: string; seedAdminEmail?: string; };
export type IdentityAuth = BaseIdentityAuth & { api: BaseIdentityAuth['api'] & { adminCreateOAuthClient(input: { headers: Headers; body: { application_type: 'native'; client_name: string; grant_types: ['authorization_code']; redirect_uris: [string]; require_pkce: true; response_types: ['code']; skip_consent: true; scope: string; software_id: string; token_endpoint_auth_method: 'none'; }; }): Promise<{ client_id: string }>; }; };
