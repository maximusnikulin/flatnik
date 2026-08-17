import { useState } from 'react'

/**
 * «Поддержать» — кнопка есть, назначение ещё не задано.
 *
 * TODO: подключить способ поддержки, когда он будет выбран. До тех пор
 * кнопка честно говорит, что пока ничего не произойдёт: молча ничего не
 * делающая кнопка читается как сломанная.
 */
export function SupportButton({ className }: { className?: string }) {
  const [isNoted, setNoted] = useState(false)

  return (
    <button
      type="button"
      className={className ?? 'btn-link'}
      onClick={() => setNoted(true)}
      aria-live="polite"
    >
      {isNoted ? 'Скоро появится' : 'Поддержать'}
    </button>
  )
}
