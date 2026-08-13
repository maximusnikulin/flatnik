import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm'

/**
 * Код подтверждения входа. Одна строка на номер: повторный запрос её перезаписывает,
 * успешный вход и просрочка — удаляют.
 *
 * В БД, а не в памяти процесса: деплой перезапускает контейнер, а в памяти это
 * обесценивало бы уже отправленную (и оплаченную) SMS вместе с паузой между запросами.
 */
@Entity('auth_codes')
export class AuthCode {
  @PrimaryColumn({ type: 'text' })
  phone!: string

  /**
   * Шесть цифр в открытом виде. Хеш здесь не защита: миллион вариантов перебирается
   * по нему мгновенно — работают короткий срок жизни и лимит попыток.
   */
  @Column({ type: 'text' })
  code!: string

  @Column({ type: 'timestamptz' })
  expiresAt!: Date

  /** Раньше этого момента новый код на номер не выдаём: каждая SMS стоит денег */
  @Column({ type: 'timestamptz' })
  nextRequestAt!: Date

  /** Неудачные попытки ввода; на пределе строка удаляется */
  @Column({ type: 'int', default: 0 })
  attempts!: number

  @CreateDateColumn()
  createdAt!: Date
}
