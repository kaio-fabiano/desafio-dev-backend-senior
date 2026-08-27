import { connectRabbitMq, type RabbitMqRuntime } from '../../commerce-subgraph/src/messaging/rabbitmq.ts';

export class StockWorkerLifecycle {
  private runtime?: RabbitMqRuntime;

  async start(): Promise<void> {
    this.runtime = await connectRabbitMq(
      process.env.RABBITMQ_URL ?? 'amqp://localhost:5672',
    );
  }

  async stop(): Promise<void> {
    await this.runtime?.close();
  }
}

async function bootstrap(): Promise<void> {
  const lifecycle = new StockWorkerLifecycle();
  await lifecycle.start();
  const stop = () => void lifecycle.stop().finally(() => process.exit(0));
  process.once('SIGTERM', stop);
  process.once('SIGINT', stop);
}

if (process.argv[1]?.endsWith('/app.module.ts')) void bootstrap();
