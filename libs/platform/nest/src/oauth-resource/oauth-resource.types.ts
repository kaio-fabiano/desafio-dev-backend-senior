import type { FactoryProvider, ModuleMetadata } from '@nestjs/common';
import type { DpopReplayStore } from 'better-auth/oauth2';

export declare class OAuthResourceOptions {
  readonly audience: string;
  readonly dpopReplayStore?: DpopReplayStore;
  readonly issuer: string;
  readonly jwksUrl: string;
}

export type OAuthResourceAsyncOptions = Pick<ModuleMetadata, 'imports'> &
  Pick<FactoryProvider<OAuthResourceOptions>, 'inject' | 'useFactory'>;
