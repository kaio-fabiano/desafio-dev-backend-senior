import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';

export class HealthController {
  private initialized = false;

  onApplicationBootstrap() {
    this.initialized = true;
  }

  health() {
    return { status: 'ok' };
  }

  ready() {
    if (!this.initialized) throw new ServiceUnavailableException();
    return { status: 'ready' };
  }
}

function descriptorFor(method: 'health' | 'ready') {
  const descriptor = Object.getOwnPropertyDescriptor(
    HealthController.prototype,
    method,
  );
  if (!descriptor) throw new Error(`Missing ${method} health handler`);
  return descriptor;
}

Controller()(HealthController);
Get('health')(HealthController.prototype, 'health', descriptorFor('health'));
Get('ready')(HealthController.prototype, 'ready', descriptorFor('ready'));
