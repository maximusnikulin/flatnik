import type { components, paths } from './api.generated'

export type { components, paths, operations } from './api.generated'

/** Схемы из OpenAPI-контракта бэкенда. Источник истины — DTO в back/src. */
export type Schemas = components['schemas']

export type HealthResponse = Schemas['HealthResponseDto']
export type HealthStatus = HealthResponse['status']

// Авторизация по телефону
export type RequestCodeRequest = Schemas['RequestCodeDto']
export type VerifyCodeRequest = Schemas['VerifyCodeDto']
export type AuthResponse = Schemas['AuthResponseDto']
export type CurrentUser = Schemas['UserDto']
export type SetNicknameRequest = Schemas['SetNicknameDto']

// Дома и квартиры
export type HousePin = Schemas['HousePinDto']
export type ApartmentSummary = Schemas['ApartmentSummaryDto']
export type HouseWithApartments = Schemas['HouseWithApartmentsDto']
export type HouseLookupResponse = Schemas['HouseLookupResponseDto']

// Отзывы
export type ReviewStatus = Schemas['ReviewStatus']
export type Review = Schemas['ReviewDto']
export type MyReview = Schemas['MyReviewDto']
export type CreateReviewRequest = Schemas['CreateReviewDto']
export type ReviewCreated = Schemas['ReviewCreatedDto']

/** Пути API как они объявлены в схеме, для типобезопасных клиентов. */
export type ApiPaths = keyof paths
