import { SupportButton } from '../../legal/ui/SupportButton'
import { useWelcomeStore } from '../model/welcome.store'

export function WelcomeModal() {
  const isOpen = useWelcomeStore((s) => s.isOpen)
  const dismiss = useWelcomeStore((s) => s.dismiss)

  if (!isOpen) return null

  return (
    <div className="modal-overlay" onClick={dismiss}>
      <div className="modal" onClick={(event) => event.stopPropagation()}>
        <header className="modal__header">
          <h2>Привет! Пара слов, прежде чем вы начнёте</h2>
          <button type="button" className="modal__close" onClick={dismiss} aria-label="Закрыть">
            ✕
          </button>
        </header>
        <div className="modal__body">
          <p>
            Мы не хотим никого обидеть — ни собственников, ни риелторов. Мы просто собрали в одном
            месте опыт арендаторов, чтобы помочь другим избежать финансовых потерь.
          </p>
          <p>
            Увидели негативный отзыв? Не спешите закрывать объявление. Спросите об этом напрямую,
            уточните детали и, если нужно, пропишите их в договоре — так спокойнее обеим сторонам.
          </p>
          <p>
            Проект некоммерческий и держится на энтузиазме. Если он оказался полезен — жми <span className='modal__support'><SupportButton /></span>
          </p>          
          <button type="button" className="modal__btn-close btn-primary" onClick={dismiss}>
            Понятно
          </button>
        </div>
      </div>
    </div>
  )
}
