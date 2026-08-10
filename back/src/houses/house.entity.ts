import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm'

/** Дом: адрес, каким его вернул геокодер, и точка на карте */
@Entity('houses')
export class House {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  /** Канонический адрес от геокодера; показывается пользователю */
  @Column({ type: 'text' })
  address!: string

  /** Нормализованный адрес для схлопывания дубликатов */
  @Column({ type: 'text', unique: true })
  addressKey!: string

  @Column({ type: 'double precision' })
  lat!: number

  @Column({ type: 'double precision' })
  lon!: number

  @CreateDateColumn()
  createdAt!: Date
}
