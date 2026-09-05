import { MikroORM, type EntityManager } from '@mikro-orm/core';
import { Module, Scope } from '@nestjs/common';

import mikroOrmConfig from './mikro-orm.config.ts';
import {
  ORDER_WORKFLOW_ENTITY_MANAGER,
  ORDER_WORKFLOW_ORM,
} from './persistence.tokens.ts';

@Module({
  providers: [
    {
      provide: ORDER_WORKFLOW_ORM,
      useFactory: () => MikroORM.init(mikroOrmConfig),
    },
    {
      provide: ORDER_WORKFLOW_ENTITY_MANAGER,
      scope: Scope.REQUEST,
      inject: [ORDER_WORKFLOW_ORM],
      useFactory: (orm: MikroORM): EntityManager => orm.em.fork(),
    },
  ],
  exports: [ORDER_WORKFLOW_ORM, ORDER_WORKFLOW_ENTITY_MANAGER],
})
export class PersistenceModule {}
