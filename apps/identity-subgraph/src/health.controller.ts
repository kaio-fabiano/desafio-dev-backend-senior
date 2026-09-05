import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';

@Controller()
export class HealthController {
  private initialized = false;

  onApplicationBootstrap() {
    this.initialized = true;
  }

  @Get('health')
  health() {
    return { status: 'ok' };
  }

  @Get('ready')
  ready() {
    if (!this.initialized) throw new ServiceUnavailableException();
    return { status: 'ready' };
  }
}
