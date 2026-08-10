import { ApiProperty } from '@nestjs/swagger'

export class HealthResponseDto {
  /** Текущее состояние сервиса */
  @ApiProperty({ enum: ['ok', 'degraded'], example: 'ok' })
  status!: 'ok' | 'degraded'

  /** Имя сервиса, ответившего на запрос */
  @ApiProperty({ example: 'back' })
  service!: string

  /** Аптайм процесса в секундах */
  @ApiProperty({ example: 1234 })
  uptime!: number

  /** Время формирования ответа, ISO 8601 */
  @ApiProperty({ format: 'date-time', example: '2026-08-10T12:00:00.000Z' })
  timestamp!: string
}
