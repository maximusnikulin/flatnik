import type { components, paths } from './api.generated'

export type { components, paths, operations } from './api.generated'

/** Схемы из OpenAPI-контракта бэкенда. Источник истины — DTO в back/src. */
export type Schemas = components['schemas']

export type HealthResponse = Schemas['HealthResponseDto']
export type HealthStatus = HealthResponse['status']

// Авторизация: телефон или почта, поле входа одно
export type RequestCodeRequest = Schemas['RequestCodeDto']
export type RequestCodeResponse = Schemas['RequestCodeResponseDto']
export type SessionPollRequest = Schemas['SessionPollDto']
export type SessionStatus = Schemas['SessionStatusDto']
export type VerifyCodeRequest = Schemas['VerifyCodeDto']
export type AuthResponse = Schemas['AuthResponseDto']
export type CurrentUser = Schemas['UserDto']
export type SetNicknameRequest = Schemas['SetNicknameDto']
// Привязка почты к уже вошедшему аккаунту: на неё уходит решение модератора
export type EmailRequest = Schemas['EmailDto']
export type VerifyEmailRequest = Schemas['VerifyEmailDto']

// Дома и квартиры
export type HousePin = Schemas['HousePinDto']
export type ApartmentSummary = Schemas['ApartmentSummaryDto']
export type HouseWithApartments = Schemas['HouseWithApartmentsDto']
export type HouseLookupResponse = Schemas['HouseLookupResponseDto']
export type HouseSlugs = Schemas['HouseSlugsDto']

// Каталог: город → улица → дом
export type CityListItem = Schemas['CityListItemDto']
export type CityPage = Schemas['CityPageDto']
export type StreetListItem = Schemas['StreetListItemDto']
export type StreetPage = Schemas['StreetPageDto']
export type StreetHouse = Schemas['StreetHouseDto']
export type HousePage = Schemas['HousePageDto']
export type HouseApartment = Schemas['HouseApartmentDto']
export type HouseReview = Schemas['HouseReviewDto']

// Отзывы
export type ReviewStatus = Schemas['ReviewStatus']
export type Review = Schemas['ReviewDto']
export type MyReview = Schemas['MyReviewDto']
export type CreateReviewRequest = Schemas['CreateReviewDto']
export type UpdateReviewRequest = Schemas['UpdateReviewDto']
export type ReviewCreated = Schemas['ReviewCreatedDto']

/** Пути API как они объявлены в схеме, для типобезопасных клиентов. */
export type ApiPaths = keyof paths
