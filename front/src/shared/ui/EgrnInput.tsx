import { useEffect, useRef } from 'react'
import { IMaskInput } from 'react-imask'

/**
 * Кадастровый номер — округ:район:квартал:объект. Квартал бывает и шестизначным,
 * поэтому седьмая цифра в маске необязательная: чтобы её пропустить, достаточно
 * набрать двоеточие. Номер объекта — от одной цифры.
 */
const EGRN_MASK = '00:00:000000[0]:0[000000000]'

/** Тот же формат, но целиком: маску можно оставить недобранной */
const EGRN_FORMAT = /^\d{2}:\d{2}:\d{6,7}:\d{1,10}$/

const EGRN_HINT = 'Кадастровый номер вида 77:01:0001075:1234'

interface EgrnInputProps {
  /** Номер с разделителями, как он уйдёт на бэкенд */
  value: string
  onChange: (egrn: string) => void
  required?: boolean
}

/** Поле кадастрового номера с маской 77:01:0001075:1234 */
export function EgrnInput({ value, onChange, ...inputProps }: EgrnInputProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  // Атрибут pattern сюда не повесить: одноимённая опция есть у самого IMask,
  // и до DOM-инпута он не доходит. Недобранный номер отсекаем через
  // штатную валидацию формы — она же покажет подсказку браузера.
  useEffect(() => {
    const isFilled = value === '' || EGRN_FORMAT.test(value)
    inputRef.current?.setCustomValidity(isFilled ? '' : EGRN_HINT)
  }, [value])

  return (
    <IMaskInput
      mask={EGRN_MASK}
      value={value}
      // onChange у IMaskInput приходит раньше маскирования — состояние ведём по onAccept
      onAccept={(egrn: string) => onChange(egrn)}
      inputRef={inputRef}
      inputMode="numeric"
      placeholder="77:01:0001075:1234"
      title={EGRN_HINT}
      {...inputProps}
    />
  )
}
