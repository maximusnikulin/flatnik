import { useEffect, useRef, useState } from 'react'

/** Сколько держится подтверждение «скопировано» */
const CONFIRM_MS = 2000

type Status = 'idle' | 'copied' | 'error'

interface ShareButtonProps {
  /** Заголовок для штатного меню шаринга */
  title: string
}

/**
 * «Поделиться» ссылкой на текущую страницу.
 *
 * Копируется не window.location.href, а origin с путём: query и якорь квартиры
 * (#kv-…) в пересылаемой ссылке не нужны, а канонический адрес страницы именно
 * такой — тот же, что стоит в canonical.
 */
export function ShareButton({ title }: ShareButtonProps) {
  const [status, setStatus] = useState<Status>('idle')
  const timer = useRef<number | null>(null)

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current)
    },
    [],
  )

  const confirm = (next: Status) => {
    setStatus(next)
    if (timer.current !== null) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setStatus('idle'), CONFIRM_MS)
  }

  const handleClick = async () => {
    const url = `${window.location.origin}${window.location.pathname}`

    // navigator.share вызывается первым и без предшествующего await: браузер
    // разрешает его только внутри пользовательского жеста
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title, url })
        return
      } catch (error: unknown) {
        // Пользователь закрыл меню — это не сбой, молчим
        if (error instanceof DOMException && error.name === 'AbortError') return
        // Остальное (например, отказ по политике) лечится копированием
      }
    }

    confirm((await copyToClipboard(url)) ? 'copied' : 'error')
  }

  return (
    <button type="button" className="btn-secondary share-button" onClick={handleClick}>
      {status === 'copied' && 'Ссылка скопирована'}
      {status === 'error' && 'Не удалось скопировать'}
      {status === 'idle' && 'Поделиться'}
    </button>
  )
}

async function copyToClipboard(url: string): Promise<boolean> {
  if (navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(url)
      return true
    } catch {
      // Ниже запасной путь
    }
  }

  // navigator.clipboard и navigator.share есть только в защищённом контексте:
  // по https или на localhost. Дев-стек, открытый с телефона по адресу вида
  // http://192.168.1.5:8080, до сюда и доходит.
  try {
    const input = document.createElement('input')
    input.value = url
    input.setAttribute('readonly', '')
    input.style.position = 'fixed'
    input.style.opacity = '0'
    document.body.append(input)
    input.select()
    const copied = document.execCommand('copy')
    input.remove()
    return copied
  } catch {
    return false
  }
}
