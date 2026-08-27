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

Controller()(HealthController);
Get('health')(
  HealthController.prototype,
  'health',
  Object.getOwnPropertyDescriptor(HealthController.prototype, 'health'),
);
Get('ready')(
  HealthController.prototype,
  'ready',
  Object.getOwnPropertyDescriptor(HealthController.prototype, 'ready'),
);
