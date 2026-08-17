import { useEffect, useRef, useState } from 'react'
import type { SuggestResponseItem } from '@yandex/ymaps3-types'
import { findAddress, useYmaps } from '../lib/ymaps'
import { useMapStore } from '../model/map.store'

/** Плавающая строка поиска адреса с саджестом Яндекса */
export function SearchBar() {
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

  const applyFound = async (query: { text: string }) => {
    setSearching(true)
    setNote(null)
    try {
      const result = await findAddress(query)
      if (result.status === 'found') {
        // Здания → панель + карта, остальное → только карта
        if (result.kind === 'house') {
          selectAddress(result.address)
        } else {
          setMapCenter([result.address.lon, result.address.lat], 17)
          // У улицы панели нет, а значит и selectedAddress не сменится —
          // строку приводим к найденному названию сами, иначе в поле
          // останется обрывок, который набрали до выбора подсказки
          appliedText.current = result.address.address
          setText(result.address.address)
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
    const picked = item.title.text
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
      <input
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder={isReady ? 'Улица и дом' : 'Поиск адреса недоступен без карты'}
        disabled={!isReady || isSearching}
        aria-label="Адрес дома"
      />
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
