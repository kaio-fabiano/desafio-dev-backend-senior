import {
  Controller,
  Get,
  ServiceUnavailableException,
  type OnApplicationBootstrap,
} from '@nestjs/common';

@Controller()
export class HealthController implements OnApplicationBootstrap {
  private initialized = false;

  onApplicationBootstrap(): void {
    this.initialized = true;
  }

  @Get('health')
  health(): { status: string } {
    return { status: 'ok' };
  }

  @Get('ready')
  ready(): { status: string } {
    if (!this.initialized) throw new ServiceUnavailableException();
    return { status: 'ready' };
  }
}
