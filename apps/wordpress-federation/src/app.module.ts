import { Module } from '@nestjs/common';

import { WordPressFederationModule } from '../../../libs/wordpress/nest/src/index.ts';

export class AppModule {}

Module({ imports: [WordPressFederationModule] })(AppModule);
