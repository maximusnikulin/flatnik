import { Controller, Get } from '@nestjs/common'
import { ApiOkResponse, ApiTags } from '@nestjs/swagger'
import { HealthResponseDto } from './health.dto'

@ApiTags('health')
@Controller('health')
export class HealthController {
  /** Проверка живости бэкенда */
  @Get()
  @ApiOkResponse({ type: HealthResponseDto })
  check(): HealthResponseDto {
    return {
      status: 'ok',
      service: 'back',
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    }
  }
}
