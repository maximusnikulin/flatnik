import { useEffect, useRef, useState } from 'react'

/**
 * Иконка «?» рядом с лейблом; тултип открывается по клику/тапу и закрывается
 * повторным кликом на «?» или тапом в любое другое место экрана.
 */
export function InfoTooltip({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLSpanElement>(null)

  // Закрываем по клику вне компонента
  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent | TouchEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('touchstart', close)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('touchstart', close)
    }
  }, [open])

  return (
    <span className="info-tooltip" ref={wrapRef}>
      <button
        type="button"
        className={`info-tooltip__trigger${open ? ' -open' : ''}`}
        aria-label="Подсказка"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        ?
      </button>
      {open && (
        <span className="info-tooltip__bubble" role="tooltip">
          {children}
        </span>
      )}
    </span>
  )
}
