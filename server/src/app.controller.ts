import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  @Get()
  getRoot() {
    return {
      service: 'grid-api',
      status: 'ok',
      health: '/api/health',
      docs: '/docs',
    };
  }
}
