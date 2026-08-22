import { MigrationInterface, QueryRunner } from 'typeorm'

export class UniqueReviewPerApartment1787000000000 implements MigrationInterface {
  name = 'UniqueReviewPerApartment1787000000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Удалить дублирующие отзывы: один пользователь — одна квартира.
    // Оставляем самый старый отзыв (наименьший createdAt), остальные удаляем.
    await queryRunner.query(`
      DELETE FROM "reviews"
      WHERE id IN (
        SELECT id FROM (
          SELECT id, ROW_NUMBER() OVER (
            PARTITION BY "authorId", "apartmentId"
            ORDER BY "createdAt" ASC
          ) AS rn
          FROM "reviews"
        ) sub
        WHERE rn > 1
      )
    `)
    await queryRunner.query(
      `ALTER TABLE "reviews" ADD CONSTRAINT "UQ_reviews_authorId_apartmentId" UNIQUE ("authorId", "apartmentId")`,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "reviews" DROP CONSTRAINT "UQ_reviews_authorId_apartmentId"`,
    )
  }
}
