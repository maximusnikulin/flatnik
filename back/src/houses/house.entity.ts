import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'

/** Дом: адрес, каким его вернул геокодер, и точка на карте */
@Entity('houses')
// Слаги образуют публичный URL /moskva/tverskaya-ulica/12, поэтому тройка
// уникальна. NULL в Postgres друг с другом не конфликтуют — дома с неразобранным
// адресом спокойно лежат все сразу.
@Index(['citySlug', 'streetSlug', 'houseSlug'], { unique: true })
export class House {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  /** Канонический адрес от геокодера; показывается пользователю */
  @Column({ type: 'text' })
  address!: string

  /** Нормализованный адрес для схлопывания дубликатов */
  @Column({ type: 'text', unique: true })
  addressKey!: string

  /**
   * Слаг города для URL: «Москва» → moskva.
   * null — адрес не разобрался: у дома нет публичной страницы и он не попадает
   * в sitemap, но в приложении работает как обычно.
   */
  @Column({ type: 'text', nullable: true })
  citySlug!: string | null

  /** Город в исходном написании: по нему строится заголовок страницы */
  @Column({ type: 'text', nullable: true })
  cityName!: string | null

  @Column({ type: 'text', nullable: true })
  streetSlug!: string | null

  /** Улица в исходном написании: «Тверская улица» */
  @Column({ type: 'text', nullable: true })
  streetName!: string | null

  /** Слаг номера дома в пределах улицы: «12с17» → 12s17 */
  @Column({ type: 'text', nullable: true })
  houseSlug!: string | null

  @Column({ type: 'double precision' })
  lat!: number

  @Column({ type: 'double precision' })
  lon!: number

  @CreateDateColumn()
  createdAt!: Date
}
