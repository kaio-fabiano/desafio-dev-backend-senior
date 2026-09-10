import type { DpopReplayStore } from 'better-auth/oauth2';

export declare class OAuthResourceOptions {
  readonly audience: string;
  readonly dpop?: { readonly replayStore: DpopReplayStore };
  readonly issuer: string;
  readonly jwksUrl: string;
}
