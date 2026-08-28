import { Global, Module } from '@nestjs/common';

import { ENVIRONMENT, environmentFactory } from './environment.factory.ts';

export class PlatformConfigModule {}

Global()(PlatformConfigModule);
Module({
  providers: [{ provide: ENVIRONMENT, useFactory: environmentFactory }],
  exports: [ENVIRONMENT],
})(PlatformConfigModule);
