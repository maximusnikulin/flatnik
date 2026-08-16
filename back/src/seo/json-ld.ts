import type { HousePageDto } from '../catalog/catalog.dto'

/**
 * Микроразметка schema.org.
 *
 * Дом размечается как ApartmentComplex — подтип Residence. Это честный тип для
 * жилого здания. Подмешивать LocalBusiness ради звёзд в выдаче Google нельзя:
 * организации у нас нет, а разметка несуществующего бизнеса — прямое нарушение
 * и повод для ручных санкций. Приоритет всё равно у Яндекса, а он schema.org
 * поддерживает шире.
 */

interface Breadcrumb {
  name: string
  url: string
}

export function breadcrumbList(items: Breadcrumb[]): unknown {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  }
}

/** Список ссылок: страницы города и улицы */
export function collectionPage(params: {
  name: string
  url: string
  items: Array<{ name: string; url: string }>
}): unknown {
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: params.name,
    url: params.url,
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: params.items.length,
      itemListElement: params.items.map((item, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: item.name,
        url: item.url,
      })),
    },
  }
}

export function houseSchema(house: HousePageDto, url: string): unknown {
  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'ApartmentComplex',
    name: `${house.streetName}, ${house.houseNumber}`,
    url,
    address: {
      '@type': 'PostalAddress',
      addressCountry: 'RU',
      addressLocality: house.cityName,
      streetAddress: `${house.streetName}, ${house.houseNumber}`,
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: house.lat,
      longitude: house.lon,
    },
  }

  // Пустой aggregateRating невалиден, а оценки нет у отзывов, написанных до её
  // появления — дом может не иметь ни одной
  if (house.ratingAvg !== null && house.ratingCount > 0) {
    schema.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: house.ratingAvg,
      reviewCount: house.ratingCount,
      bestRating: 5,
      worstRating: 1,
    }
  }

  if (house.reviews.length > 0) {
    schema.review = house.reviews.map((review) => {
      const item: Record<string, unknown> = {
        '@type': 'Review',
        author: { '@type': 'Person', name: review.authorName },
        datePublished: review.createdAt.slice(0, 10),
        reviewBody: review.text,
      }
      if (review.rating !== null) {
        item.reviewRating = {
          '@type': 'Rating',
          ratingValue: review.rating,
          bestRating: 5,
          worstRating: 1,
        }
      }
      return item
    })
  }

  return schema
}
