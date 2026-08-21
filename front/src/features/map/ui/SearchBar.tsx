import { useEffect, useRef, useState } from 'react'
import type { SuggestResponseItem } from '@yandex/ymaps3-types'
import { findAddress, useYmaps } from '../lib/ymaps'
import { useMapStore } from '../model/map.store'

interface SearchBarProps {
  /** Есть ли на странице карта. Без неё найденную улицу показать негде —
   *  вместо перелёта камеры остаётся попросить уточнить номер дома.
   *  На мобильном (hasMap=false) input заменяется на textarea с авторесайзом */
  hasMap: boolean
}

/** Строка поиска адреса с саджестом Яндекса: на карте — плавающая, без карты
 *  (мобильная главная без MapView) — обычная строка в шапке */
export function SearchBar({ hasMap }: SearchBarProps) {
  const ymaps = useYmaps()
  const selectedAddress = useMapStore((s) => s.selectedAddress)
  const selectAddress = useMapStore((s) => s.selectAddress)
  const setMapCenter = useMapStore((s) => s.setMapCenter)
  const clearSelection = useMapStore((s) => s.clearSelection)

  const [text, setText] = useState('')
  const [items, setItems] = useState<SuggestResponseItem[]>([])
  const [isSearching, setSearching] = useState(false)
  const [note, setNote] = useState<string | null>(null)

  /** Строка, которую поиск уже применил: по ней саджест открываться не должен,
   *  иначе список выскакивает снова сразу после выбора подсказки */
  const appliedText = useRef('')

  /** Ref на textarea (только на мобильном, hasMap=false) для авторесайза */
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Выбор адреса извне (клик по пину) отражается в строке поиска
  useEffect(() => {
    const address = selectedAddress?.address ?? ''
    appliedText.current = address
    setText(address)
    setItems([])
    setNote(null)
  }, [selectedAddress])

  // Саджест с debounce; устаревшие ответы отбрасываются
  useEffect(() => {
    if (ymaps.status !== 'ready') return
    const query = text.trim()
    if (query.length < 3 || query === appliedText.current) {
      setItems([])
      return
    }
    let cancelled = false
    const handle = window.setTimeout(() => {
      ymaps3
        .suggest({ text: query, types: ['house', 'street'], limit: 6 })
        .then((response) => {
          if (!cancelled) setItems([...response])
        })
        .catch(() => {
          // Саджест может быть не включён для ключа — остаётся поиск по Enter
          if (!cancelled) setItems([])
        })
    }, 300)
    return () => {
      cancelled = true
      window.clearTimeout(handle)
    }
  }, [text, ymaps.status])

  // Авторесайз textarea (мобильный): пересчитываем высоту при каждом изменении
  // текста — в том числе при внешнем обновлении (выбор из саджеста, клик на пин)
  useEffect(() => {
    if (hasMap || !textareaRef.current) return
    const el = textareaRef.current
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [text, hasMap])

  const applyFound = async (query: { text: string }) => {
    setSearching(true)
    setNote(null)
    try {
      const result = await findAddress(query)
      if (result.status === 'found') {
        // Здания → панель дома (на карте и без неё), остальное — только карте
        // есть куда перелететь; без неё остаётся попросить уточнить дом
        if (result.kind === 'house') {
          selectAddress(result.address)
        } else if (hasMap) {
          setMapCenter([result.address.lon, result.address.lat], 17)
          // У улицы панели нет, а значит и selectedAddress не сменится —
          // строку приводим к найденному названию сами, иначе в поле
          // останется обрывок, который набрали до выбора подсказки
          appliedText.current = result.address.address
          setText(result.address.address)
        } else {
          setNote('Уточните номер дома — отзывы собираются по конкретным домам.')
        }
      } else if (result.status === 'not-found') {
        setNote('Такой адрес не найден. Уточните улицу и номер дома.')
      } else {
        setNote(`Поиск адреса недоступен: ${result.message}`)
      }
    } finally {
      setSearching(false)
      setItems([])
    }
  }

  const handlePick = (item: SuggestResponseItem) => {
    // Подставляем сразу, не дожидаясь геокодера: пока летит ответ, в поле
    // не должно стоять то, что пользователь набрал до выбора
    // Собираем полный адрес: заголовок + подзаголовок (город)
    const picked = [item.title.text, item.subtitle?.text].filter(Boolean).join(', ')
    appliedText.current = picked
    setText(picked)
    // uri не поддерживается Geocoder REST API — используем текстовый адрес
    void applyFound({ text: picked })
  }

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    if (ymaps.status === 'ready' && text.trim().length >= 3) {
      void applyFound({ text: text.trim() })
    }
  }

  /** Курсор в конец при фокусе — пользователю проще дописать номер дома */
  const handleFocus = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const el = e.currentTarget
    const len = el.value.length
    // requestAnimationFrame нужен для iOS Safari: браузер иногда сбрасывает
    // позицию курсора после того как выставила его родительская логика фокуса
    requestAnimationFrame(() => el.setSelectionRange(len, len))
  }

  /** Enter в textarea не добавляет перенос строки — отправляет форму */
  const handleTextareaKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (ymaps.status === 'ready' && text.trim().length >= 3) {
        void applyFound({ text: text.trim() })
        setItems([])
      }
    }
  }

  const handleClear = () => {
    // Сбрасываем и здесь: если адрес не был выбран, эффект на selectedAddress
    // не сработает и применённая строка осталась бы от прошлого поиска
    appliedText.current = ''
    setText('')
    setItems([])
    setNote(null)
    clearSelection()
  }

  const isReady = ymaps.status === 'ready'

  return (
    <form className="search-bar" onSubmit={handleSubmit}>
      <span className="search-bar__pin" aria-hidden>
        <svg viewBox="0 0 24 24" width="20" height="20">
          <path
            fill="currentColor"
            d="M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z"
          />
        </svg>
      </span>
      {hasMap ? (
        <input
          value={text}
          onChange={(event) => setText(event.target.value)}
          onFocus={handleFocus}
          placeholder={isReady ? 'Улица и дом' : 'Поиск адреса недоступен без карты'}
          disabled={!isReady || isSearching}
          aria-label="Адрес дома"
        />
      ) : (
        /* На мобильном — textarea с авторесайзом: адрес виден целиком даже если
           не влезает в одну строку; Enter не переносит строку, а запускает поиск */
        <textarea
          ref={textareaRef}
          rows={1}
          value={text}
          onChange={(event) => setText(event.target.value)}
          onFocus={handleFocus}
          onKeyDown={handleTextareaKeyDown}
          placeholder={isReady ? 'Улица и дом' : 'Поиск адреса недоступен без карты'}
          disabled={!isReady || isSearching}
          aria-label="Адрес дома"
        />
      )}
      <button type="submit" className="search-bar__icon" disabled={!isReady} aria-label="Найти">
        <svg viewBox="0 0 24 24" width="18" height="18">
          <path
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            d="M10.5 17a6.5 6.5 0 1 1 0-13 6.5 6.5 0 0 1 0 13zm10 3.5-5-5"
          />
        </svg>
      </button>
      <button type="button" className="search-bar__icon" onClick={handleClear} aria-label="Очистить">
        <svg viewBox="0 0 24 24" width="18" height="18">
          <path fill="none" stroke="currentColor" strokeWidth="2" d="m6 6 12 12M18 6 6 18" />
        </svg>
      </button>
      {note && <p className="search-bar__note">{note}</p>}
      {items.length > 0 && (
        <ul className="suggest-list">
          {items.map((item, index) => (
            <li key={item.uri ?? `${item.title.text}-${index}`}>
              <button type="button" onClick={() => handlePick(item)}>
                <span className="suggest-list__title">{item.title.text}</span>
                {item.subtitle && <span className="suggest-list__subtitle">{item.subtitle.text}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </form>
  )
}
