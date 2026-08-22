import { MigrationInterface, QueryRunner } from 'typeorm'

export class UniqueReviewPerApartment1787000000000 implements MigrationInterface {
  name = 'UniqueReviewPerApartment1787000000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
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
