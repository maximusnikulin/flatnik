import { IMaskInput } from 'react-imask'

/** Код страны вшит в маску, наружу отдаются только 10 цифр номера */
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

interface PhoneInputProps {
  /** Десять цифр номера без кода страны */
  value: string
  /** Приходят те же десять цифр, без маски */
  onChange: (digits: string) => void
  autoFocus?: boolean
  required?: boolean
}

/** Поле телефона с маской +7 (999) 123-45-67 */
export function PhoneInput({ value, onChange, ...inputProps }: PhoneInputProps) {
  return (
    <IMaskInput
      mask={PHONE_MASK}
      prepare={dropCountryCode}
      prepareChar={dropCountryCodeChar}
      unmask
      value={value}
      // onChange у IMaskInput приходит раньше маскирования — состояние ведём по onAccept
      onAccept={(digits: string) => onChange(digits)}
      type="tel"
      inputMode="tel"
      placeholder="+7 (999) 123-45-67"
      {...inputProps}
    />
  )
}
