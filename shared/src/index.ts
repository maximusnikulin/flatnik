export type HealthStatus = 'ok' | 'degraded'

export interface HealthResponse {
  status: HealthStatus
  service: string
  uptime: number
  timestamp: string
}
