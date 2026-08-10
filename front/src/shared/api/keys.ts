/**
 * Корни ключей Query. Фичи строят свои ключи от этих корней, а мутации
 * инвалидируют по корню — без импорта фабрик чужих фич.
 */
export const queryKeyRoots = {
  houses: ['houses'] as const,
  reviews: ['reviews'] as const,
  auth: ['auth'] as const,
}
