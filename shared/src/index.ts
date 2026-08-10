import type { components, paths } from './api.generated'

export type { components, paths, operations } from './api.generated'

/** Схемы из OpenAPI-контракта бэкенда. Источник истины — DTO в back/src. */
export type Schemas = components['schemas']

export type HealthResponse = Schemas['HealthResponseDto']
export type HealthStatus = HealthResponse['status']

/** Пути API как они объявлены в схеме, для типобезопасных клиентов. */
export type ApiPaths = keyof paths
