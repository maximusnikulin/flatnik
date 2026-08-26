import { useEffect, useRef, useState } from 'react'
import { IMask, IMaskInput } from 'react-imask'
import { MIN_MONTH, formatMonth, parseMonth } from '../lib/month'

/**
 * Нативного выбора месяца нет в Firefox: там type="month" откатывается
 * в обычное текстовое поле, куда можно набрать что угодно. Отличаем по
 * санитайзингу значения — браузер с поддержкой чистит то, что месяцем не является.
 */
const SUPPORTS_MONTH = (() => {
  const probe = document.createElement('input')
  probe.setAttribute('type', 'month')
  probe.value = 'не месяц'
  return probe.type === 'month' && probe.value === ''
})()

/**
 * WebKit умеет type="month" с Safari 14.1, но рисует контрол нативной темой: тот
 * не сжимается ниже своего содержимого и вылезает за края модалки на мобильном.
 * Ведём такие браузеры по той же ветке с маской, что и Firefox.
 *
 * Ловим не только Safari: под iOS любой браузер обязан работать на WebKit, и
 * тамошние Chrome (CriOS) и Яндекс (YaBrowser) получают ровно тот же контрол.
 * Их UA не содержит «Chrome», поэтому исключающий список их не задевает — а вот
 * Android-Chrome и десктопные Chromium-браузеры отсекает, им нативный пикер ок.
 */
const IS_WEBKIT =
  /safari/i.test(navigator.userAgent) && !/chrome|chromium|android/i.test(navigator.userAgent)

/** Ветка ввода: нативный пикер или маска ММ.ГГГГ */
const USE_NATIVE_MONTH = SUPPORTS_MONTH && !IS_WEBKIT

const MONTH_HINT = 'Месяц и год в формате ММ.ГГГГ'

const MASK_BLOCKS = {
  // autofix: 'pad' дописывает ведущий ноль, когда после «3» набирают точку
  MM: { mask: IMask.MaskedRange, from: 1, to: 12, maxLength: 2, autofix: 'pad' as const },
  YYYY: {
    mask: IMask.MaskedRange,
    from: Number(MIN_MONTH.slice(0, 4)),
    to: new Date().getFullYear(),
    maxLength: 4,
  },
}

interface MonthInputProps {
  /** Месяц в формате хранения, 'YYYY-MM'; пустая строка — не задан */
  value: string
  onChange: (month: string) => void
  /** Границы включительно, в том же формате */
  min: string
  max: string
  'aria-label': string
}

/** Поле месяца и года: нативный пикер в Chrome, маска ММ.ГГГГ в Safari и Firefox */
export function MonthInput({ value, onChange, min, max, ...inputProps }: MonthInputProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  // Формат маски не совпадает с форматом хранения, а недобранное «03.» в 'YYYY-MM'
  // вообще не выражается — поэтому набор в этой ветке ведётся локально
  const [display, setDisplay] = useState(() => formatMonth(value))

  useEffect(() => {
    // Сюда приходят только внешние смены значения: правка отзыва и reset после
    // отправки. Свой ввод не трогаем — пока он разбирается в тот же месяц, всё сходится
    if (parseMonth(display) !== value) setDisplay(formatMonth(value))
  }, [value])

  // Границы проверяем сами в обеих ветках: у поля с маской своей проверки нет,
  // а нативному сообщение о выходе за min/max нужно перебить — оно на языке браузера
  useEffect(() => {
    let message = ''
    if (value === '') {
      // Начатый, но недобранный ввод виден только по маске
      message = USE_NATIVE_MONTH || display === '' ? '' : MONTH_HINT
    } else if (value < min) {
      message = `Не раньше ${formatMonth(min)}`
    } else if (value > max) {
      message = `Не позже ${formatMonth(max)}`
    }
    inputRef.current?.setCustomValidity(message)
  }, [value, display, min, max])

  if (USE_NATIVE_MONTH) {
    return (
      <input
        ref={inputRef}
        type="month"
        value={value}
        min={min}
        max={max}
        onChange={(event) => onChange(event.target.value)}
        {...inputProps}
      />
    )
  }

  return (
    <IMaskInput
      mask="MM.YYYY"
      blocks={MASK_BLOCKS}
      value={display}
      // onChange у IMaskInput приходит раньше маскирования — состояние ведём по onAccept.
      // min и max сюда не раскидываем: у MaskedRange это свои опции, они сломают маску
      onAccept={(next: string) => {
        setDisplay(next)
        onChange(parseMonth(next))
      }}
      inputRef={inputRef}
      inputMode="numeric"
      placeholder="03.2024"
      title={MONTH_HINT}
      {...inputProps}
    />
  )
}
