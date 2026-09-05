import { MigrationInterface, QueryRunner } from "typeorm";

export class AddReviewEditedByAdmin1788631150531 implements MigrationInterface {
    name = 'AddReviewEditedByAdmin1788631150531'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "reviews" ADD "editedByAdmin" boolean NOT NULL DEFAULT false`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "reviews" DROP COLUMN "editedByAdmin"`);
    }

}
