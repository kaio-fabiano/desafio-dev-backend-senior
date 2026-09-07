export type OAuthClientSeed = { name: string; redirectUri: string; softwareId: string; };
export type OAuthClientBody = { application_type: 'native'; client_name: string; grant_types: ['authorization_code']; redirect_uris: [string]; require_pkce: true; response_types: ['code']; skip_consent: true; scope: string; software_id: string; token_endpoint_auth_method: 'none'; };
