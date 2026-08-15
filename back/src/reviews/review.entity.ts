import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm'
import { Apartment } from '../houses/apartment.entity'
import { User } from '../users/user.entity'
import { ReviewStatus } from './review-status'

/** Отзыв о съёме конкретной квартиры */
@Entity('reviews')
@Check('"rating" IS NULL OR ("rating" BETWEEN 1 AND 5)')
export class Review {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ type: 'uuid' })
  apartmentId!: string

  @ManyToOne(() => Apartment, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'apartmentId' })
  apartment!: Apartment

  @Column({ type: 'uuid' })
  authorId!: string

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'authorId' })
  author!: User

  /** Кадастровый номер из выписки ЕГРН; автоматически не проверяется */
  @Column({ type: 'text' })
  egrn!: string

  @Column({ type: 'text' })
  text!: string

  /** Оценка от 1 до 5; null — отзыв написан до появления рейтинга */
  @Column({ type: 'smallint', nullable: true })
  rating!: number | null

  /** Начало периода съёма; колонки date TypeORM возвращает строками */
  @Column({ type: 'date', nullable: true })
  periodFrom!: string | null

  /** Конец периода съёма */
  @Column({ type: 'date', nullable: true })
  periodTo!: string | null

  @Column({ type: 'enum', enum: ReviewStatus, default: ReviewStatus.Pending })
  status!: ReviewStatus

  /** Причина последнего отклонения; правка отзыва отправляет его на проверку заново и обнуляет её */
  @Column({ type: 'text', nullable: true })
  rejectionReason!: string | null

  @CreateDateColumn()
  createdAt!: Date

  /** Дата последней правки; по ней сортируется список своих отзывов */
  @UpdateDateColumn()
  updatedAt!: Date
}
