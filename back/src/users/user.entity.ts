import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm'

/** Пользователь; идентифицируется телефоном, имя появляется из формы отзыва */
@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ type: 'text', unique: true })
  phone!: string

  @Column({ type: 'text', nullable: true })
  name!: string | null

  @CreateDateColumn()
  createdAt!: Date
}
