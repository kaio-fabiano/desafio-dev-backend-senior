import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { json, type NextFunction, type Request, type Response } from 'express';
import 'reflect-metadata';

import { AppModule } from './app.module.ts';
import gatewayGraphiqlPage from './graphiql/gateway-graphiql-page.ts';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  const parseJson = json();
  app.use(
    '/graphql',
    (request: Request, response: Response, next: NextFunction) => {
      if (
        request.method === 'GET' &&
        request.path === '/' &&
        request.get('accept')?.toLowerCase().includes('text/html')
      ) {
        response.type('html').send(gatewayGraphiqlPage);
        return;
      }
      if (request.path === '/stream') {
        next();
        return;
      }
      parseJson(request, response, next);
    },
  );
  app.enableShutdownHooks();
  const config = app.get(ConfigService);
  await app.listen(Number(config.get('PORT', '3000')));
}

if (import.meta.main) void bootstrap();
