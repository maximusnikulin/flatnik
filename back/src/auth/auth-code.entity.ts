import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm'

/** Каким путём идёт эта попытка входа */
export type AuthChannel = 'mobile-id' | 'code'

/**
 * Начатая попытка входа. Одна строка на номер: повторный запрос её перезаписывает,
 * успешный вход и просрочка — удаляют.
 *
 * В БД, а не в памяти процесса: деплой перезапускает контейнер, а в памяти это
 * обесценивало бы уже начатую (и оплаченную) авторизацию вместе с паузой между
 * запросами.
 */
@Entity('auth_codes')
export class AuthCode {
  @PrimaryColumn({ type: 'text' })
  phone!: string

  /**
   * `mobile-id` — подтверждение проверяет провайдер, `code` — запасной путь
   * с нашим кодом в Telegram.
   */
  @Column({ type: 'text', default: 'code' })
  channel!: AuthChannel

  /** Идентификатор заявки мобильной авторизации; у запасного пути его нет */
  @Column({ type: 'text', nullable: true })
  requestId!: string | null

  /**
   * Шесть цифр в открытом виде — только для запасного пути. Хеш здесь не защита:
   * миллион вариантов перебирается по нему мгновенно — работают короткий срок
   * жизни и лимит попыток. У mobile-id кода нет: его знает провайдер.
   */
  @Column({ type: 'text', nullable: true })
  code!: string | null

  /**
   * Секрет для опроса статуса, выдаётся фронту при запросе. Без него опрашивать
   * чужой номер мог бы кто угодно: подтверждение на SIM-карте вводом не
   * сопровождается, и невнимательно подтверждённый запрос отдал бы токен тому,
   * кто в этот момент опрашивает.
   */
  @Column({ type: 'text', default: '' })
  pollSecret!: string

  /** Когда последний раз спрашивали статус у провайдера — троттлинг опроса */
  @Column({ type: 'timestamptz', nullable: true })
  lastPollAt!: Date | null

  @Column({ type: 'timestamptz' })
  expiresAt!: Date

  /** Раньше этого момента новую попытку на номер не заводим: она стоит денег */
  @Column({ type: 'timestamptz' })
  nextRequestAt!: Date

  /** Неудачные попытки ввода кода; на пределе код гасится */
  @Column({ type: 'int', default: 0 })
  attempts!: number

  @CreateDateColumn()
  createdAt!: Date
}
