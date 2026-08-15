import { MigrationInterface, QueryRunner } from "typeorm";

export class AddReviewRating1786826009730 implements MigrationInterface {
    name = 'AddReviewRating1786826009730'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "reviews" ADD "rating" smallint`);
        await queryRunner.query(`ALTER TABLE "reviews" ADD CONSTRAINT "CHK_90761afb48e4b58a8d8e5ad17d" CHECK ("rating" IS NULL OR ("rating" BETWEEN 1 AND 5))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "reviews" DROP CONSTRAINT "CHK_90761afb48e4b58a8d8e5ad17d"`);
        await queryRunner.query(`ALTER TABLE "reviews" DROP COLUMN "rating"`);
    }

}
