import { MigrationInterface, QueryRunner } from "typeorm";

export class AddReviewUpdatedAt1786636801999 implements MigrationInterface {
    name = 'AddReviewUpdatedAt1786636801999'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "reviews" ADD "updatedAt" TIMESTAMP NOT NULL DEFAULT now()`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "reviews" DROP COLUMN "updatedAt"`);
    }

}
