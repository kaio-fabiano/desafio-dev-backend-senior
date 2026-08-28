import type { OnApplicationShutdown, OnModuleInit } from '@nestjs/common';

export interface ManagedResource {
  close(): void | Promise<void>;
}

/**
 * Base contract for infrastructure resources owned by a NestJS application.
 * Subclasses are registered as providers, which makes creation and shutdown
 * part of the application lifecycle instead of bootstrap code.
 */
export abstract class ResourceProvider<T extends ManagedResource>
  implements OnModuleInit, OnApplicationShutdown
{
  private resource?: T;

  protected abstract create(): T | Promise<T>;

  protected get current(): T {
    if (!this.resource) {
      throw new Error('Resource is not initialized');
    }
    return this.resource;
  }

  async onModuleInit(): Promise<void> {
    this.resource = await this.create();
  }

  async onApplicationShutdown(): Promise<void> {
    await this.resource?.close();
  }
}
