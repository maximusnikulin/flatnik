import { Controller, Get } from '@nestjs/common'
import type { HealthResponse } from '@flatnik/shared'

@Controller('health')
export class HealthController {
  @Get()
  check(): HealthResponse {
    return {
      status: 'ok',
      service: 'back',
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    }
  }
}
