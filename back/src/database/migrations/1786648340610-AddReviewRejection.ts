import { MigrationInterface, QueryRunner } from "typeorm";

export class AddReviewRejection1786648340610 implements MigrationInterface {
    name = 'AddReviewRejection1786648340610'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "reviews" ADD "rejectionReason" text`);
        await queryRunner.query(`ALTER TYPE "public"."reviews_status_enum" ADD VALUE 'rejected'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."reviews_status_enum_old" AS ENUM('pending', 'confirmed')`);
        await queryRunner.query(`ALTER TABLE "reviews" ALTER COLUMN "status" TYPE "public"."reviews_status_enum_old" USING "status"::"text"::"public"."reviews_status_enum_old"`);
        await queryRunner.query(`DROP TYPE "public"."reviews_status_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."reviews_status_enum_old" RENAME TO "reviews_status_enum"`);
        await queryRunner.query(`ALTER TABLE "reviews" DROP COLUMN "rejectionReason"`);
    }

}
