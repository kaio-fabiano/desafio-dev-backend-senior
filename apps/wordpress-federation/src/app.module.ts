import { Module } from '@nestjs/common';

import { WordPressFederationModule } from '@desafio-dev-backend-senior/source/wordpress-nest';

export class AppModule {}

Module({ imports: [WordPressFederationModule] })(AppModule);
