import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm'
import { House } from './house.entity'

/** Квартира в доме; уникальна парой (дом, номер) */
@Entity('apartments')
@Unique(['houseId', 'number'])
export class Apartment {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ type: 'uuid' })
  houseId!: string

  @ManyToOne(() => House, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'houseId' })
  house!: House

  /** Номер квартиры строкой: бывают «12А» и дроби */
  @Column({ type: 'text' })
  number!: string

  /** Подъезд; вводится вручную — API Яндекса подъезды не отдаёт */
  @Column({ type: 'text' })
  entrance!: string

  @CreateDateColumn()
  createdAt!: Date
}
