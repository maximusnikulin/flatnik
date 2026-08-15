/**
 * Слаги адреса для публичных URL вида /moskva/tverskaya-ulica/12.
 *
 * Адрес приходит от геокодера одной строкой — «Москва, Тверская улица, 12с17».
 * Разбирать её на части приходится здесь: отдельных полей города и улицы у
 * Яндекса мы не запрашиваем, а хранить адрес разобранным было бы дублированием.
 *
 * ВАЖНО: таблица транслитерации и правила разбора заморожены. Их правка меняет
 * URL уже проиндексированных страниц, то есть требует редиректов 301 со старых
 * адресов — это отдельное решение, а не попутное улучшение.
 */

/** Разобранный адрес: «Москва, Тверская улица, 12с17» */
export interface AddressParts {
  cityName: string
  streetName: string
  houseNumber: string
}

export interface HouseSlugs extends AddressParts {
  citySlug: string
  streetSlug: string
  houseSlug: string
}

/**
 * Номер дома одной частью: «12», «12с17», «10А». Пробелов внутри нет — иначе
 * под шаблон попала бы «1-я Тверская-Ямская улица», которая тоже с цифры.
 */
const HOUSE_NUMBER = /^\d+[а-яёa-z\d/-]*$/iu

/** Продолжение номера отдельной частью: «стр. 1», «корп 2», «влд 5» */
const HOUSE_TAIL = /^(д|дом|влд|вл|стр|строение|соор|сооружение|к|корп|корпус)\.?\s*\d+[а-яё]*$/iu

const TRANSLIT: Record<string, string> = {
  а: 'a',
  б: 'b',
  в: 'v',
  г: 'g',
  д: 'd',
  е: 'e',
  ё: 'e',
  ж: 'zh',
  з: 'z',
  и: 'i',
  й: 'y',
  к: 'k',
  л: 'l',
  м: 'm',
  н: 'n',
  о: 'o',
  п: 'p',
  р: 'r',
  с: 's',
  т: 't',
  у: 'u',
  ф: 'f',
  х: 'h',
  ц: 'c',
  ч: 'ch',
  ш: 'sh',
  щ: 'sch',
  ъ: '',
  ы: 'y',
  ь: '',
  э: 'e',
  ю: 'yu',
  я: 'ya',
}

/** «Тверская улица» → «tverskaya-ulica» */
export function slugify(value: string): string {
  const translitted = value
    .toLowerCase()
    .split('')
    .map((char) => (char in TRANSLIT ? TRANSLIT[char] : char))
    .join('')

  return translitted
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * Разбирает адрес геокодера на город, улицу и дом.
 * null — адрес не похож на «город, улица, дом»: у такого дома публичной
 * страницы не будет, но в приложении он работает как обычно.
 */
export function parseAddress(address: string): AddressParts | null {
  const parts = address
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0)

  if (parts.length < 3) {
    return null
  }

  // Номер дома может занимать несколько частей: «… , 21, стр. 1»
  let tailStart = parts.length
  while (tailStart > 0 && HOUSE_TAIL.test(parts[tailStart - 1])) {
    tailStart -= 1
  }
  if (tailStart === 0 || !HOUSE_NUMBER.test(parts[tailStart - 1])) {
    return null
  }
  tailStart -= 1

  // Улица идёт прямо перед номером, город — прямо перед улицей. Не первая
  // часть: у геокодера слева может стоять регион («Московская область, Химки,
  // …»), а у старых записей — ещё и страна.
  if (tailStart < 2) {
    return null
  }

  return {
    cityName: parts[tailStart - 2],
    streetName: parts[tailStart - 1],
    houseNumber: parts.slice(tailStart).join(' '),
  }
}

/** Разбирает адрес и считает слаги; null — адрес не разобрался */
export function buildHouseSlugs(address: string): HouseSlugs | null {
  const parts = parseAddress(address)
  if (!parts) {
    return null
  }

  const citySlug = slugify(parts.cityName)
  const streetSlug = slugify(parts.streetName)
  const houseSlug = slugify(parts.houseNumber)
  // Латиницы и цифр не осталось ни в одной из частей — слаг был бы пустым
  if (!citySlug || !streetSlug || !houseSlug) {
    return null
  }

  return { ...parts, citySlug, streetSlug, houseSlug }
}
