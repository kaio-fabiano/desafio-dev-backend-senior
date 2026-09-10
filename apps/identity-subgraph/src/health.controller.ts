import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { IdentityErrorMessages } from '@desafio-dev-backend-senior/source/identity-nest';

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
    if (!this.initialized) {
      throw new ServiceUnavailableException(
        IdentityErrorMessages.healthNotReady,
      );
    }
    return { status: 'ready' };
  }
}
