import { useEffect, useRef } from 'react'
import { IMaskInput } from 'react-imask'

/**
 * Регистрационная запись права собственности из выписки ЕГРН.
 * Формат: {кадастровый_номер}-{регион}/{отдел}/{год}-{порядковый_номер}
 * Пример: 77:01:0003036:1308-77/011/2018-1
 *
 * Кадастровая часть совпадает с маской EgrnInput:
 *   округ (2) : район (2) : квартал (6-7) : объект (1-10)
 * Регистрационная часть:
 *   регион (2) / отдел (3) / год (4) - порядковый № (1-7)
 */
const REG_RECORD_MASK = '00:00:000000[0]:0[000000000]-00/000/0000-0[000000]'

const REG_RECORD_FORMAT =
  /^\d{2}:\d{2}:\d{6,7}:\d{1,10}-\d{2}\/\d{3}\/\d{4}-\d{1,7}$/

const REG_RECORD_HINT =
  'Запись регистрации права вида 77:01:0001011:1101-77/011/2011-1'

interface RegRecordInputProps {
  /** Полный номер с разделителями, как он уйдёт на бэкенд */
  value: string
  onChange: (value: string) => void
  required?: boolean
}

/**
 * Поле «Запись регистрации права» с маской 77:01:0003036:1308-77/011/2018-1.
 * Состоит из кадастрового номера объекта и номера регистрационной записи,
 * разделённых дефисом.
 */
export function RegRecordInput({ value, onChange, ...inputProps }: RegRecordInputProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const isFilled = value === '' || REG_RECORD_FORMAT.test(value)
    inputRef.current?.setCustomValidity(isFilled ? '' : REG_RECORD_HINT)
  }, [value])

  return (
    <IMaskInput
      mask={REG_RECORD_MASK}
      value={value}
      onAccept={(v: string) => onChange(v)}
      inputRef={inputRef}
      inputMode="numeric"
      placeholder="77:01:0003036:1308-77/011/2018-1"
      title={REG_RECORD_HINT}
      {...inputProps}
    />
  )
}
