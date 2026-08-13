import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'

/** Пользователь; аккаунт привязан к телефону, публично виден только никнейм */
@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ type: 'text', unique: true })
  phone!: string

  /** Публичное имя: им подписаны отзывы. Регистр хранится как ввёл пользователь */
  @Column({ type: 'text' })
  nickname!: string

  /**
   * Тот же ник в нижнем регистре — на нём висит уникальность.
   * Отдельная колонка, а не уникальный индекс по lower(nickname): выражение
   * в индексе TypeORM не видит в метаданных сущности, и migration:generate
   * пытался бы его удалять при каждой генерации.
   */
  @Index({ unique: true })
  @Column({ type: 'text' })
  nicknameLower!: string

  /**
   * false — ник сгенерирован автоматически при создании аккаунта и пользователь
   * его ещё не выбирал. Ник обязателен всегда (отзыв должен быть чем-то подписан),
   * поэтому «не задан» выражается флагом, а не null.
   */
  @Column({ type: 'boolean', default: false })
  nicknameConfirmed!: boolean

  @CreateDateColumn()
  createdAt!: Date
}
