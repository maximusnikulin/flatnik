import { IMaskInput } from 'react-imask'

/** Код страны вшит в маску телефонной ветки */
const PHONE_MASK = '+7 (000) 000-00-00'

/**
 * Ведущие «+7», «7» и «8» из ввода выбрасываем — иначе привычное «8 999…»
 * уехало бы в первую цифру номера, для которой кода страны в маске уже нет.
 * Российские мобильные начинаются с девятки, так что своя цифра так не теряется.
 *
 * Правил два, потому что IMask зовёт их по разным путям: `prepare` — на вставку
 * строки целиком, `prepareChar` — на посимвольный набор.
 */
function dropCountryCode(appended: string, masked: { value: string }): string {
  return masked.value === '' ? appended.replace(/^\+?[78]\D*/, '') : appended
}

function dropCountryCodeChar(char: string, masked: { value: string }): string {
  return masked.value === '' && /^[+78]$/.test(char) ? '' : char
}

/** Всё, что не встречается в телефоне, переключает поле на почту */
const NOT_PHONE = /[^\d\s()+-]/

/**
 * Две маски в одном поле: телефонная с форматированием и свободная для почты.
 * Выбор делает `dispatch` на каждом введённом символе.
 */
const LOGIN_MASK = [
  { mask: PHONE_MASK, prepare: dropCountryCode, prepareChar: dropCountryCodeChar },
  { mask: /^\S*$/ },
]

interface LoginInputProps {
  /** То, что видно в поле: маска телефона или адрес почты как есть */
  value: string
  /** Приходят и отображаемая строка, и десять цифр — из них собирается +7XXXXXXXXXX */
  onChange: (value: string, digits: string) => void
  autoFocus?: boolean
  required?: boolean
}

/** Поле входа: принимает телефон и почту, вид определяется по вводу */
export function LoginInput({ value, onChange, ...inputProps }: LoginInputProps) {
  return (
    <IMaskInput
      mask={LOGIN_MASK}
      // Ветку выбираем по всей строке, а не по одному символу: иначе «9» после
      // «me@» вернуло бы поле на телефонную маску и съело набранный адрес
      dispatch={(appended, masked) => {
        const next = masked.value + appended
        return masked.compiledMasks[NOT_PHONE.test(next) ? 1 : 0]
      }}
      value={value}
      // unmask здесь не ставим: он действует на обе ветки сразу и из почты
      // выбросил бы всё, кроме цифр. Цифры телефона достаём из maskRef сами
      onAccept={(next: string, maskRef) => {
        onChange(next, maskRef.unmaskedValue.replace(/\D/g, ''))
      }}
      inputMode="email"
      placeholder="Телефон или email"
      {...inputProps}
    />
  )
}
