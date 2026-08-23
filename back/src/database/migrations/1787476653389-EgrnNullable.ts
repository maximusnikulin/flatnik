import { MigrationInterface, QueryRunner } from "typeorm";

export class EgrnNullable1787476653389 implements MigrationInterface {
    name = 'EgrnNullable1787476653389'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "reviews" DROP CONSTRAINT "UQ_reviews_authorId_apartmentId"`);
        await queryRunner.query(`ALTER TABLE "auth_codes" ALTER COLUMN "kind" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "reviews" ALTER COLUMN "egrn" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "reviews" ADD CONSTRAINT "UQ_81aa4c54422aee6003c1a7d18bd" UNIQUE ("authorId", "apartmentId")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "reviews" DROP CONSTRAINT "UQ_81aa4c54422aee6003c1a7d18bd"`);
        await queryRunner.query(`ALTER TABLE "reviews" ALTER COLUMN "egrn" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "auth_codes" ALTER COLUMN "kind" SET DEFAULT 'phone'`);
        await queryRunner.query(`ALTER TABLE "reviews" ADD CONSTRAINT "UQ_reviews_authorId_apartmentId" UNIQUE ("apartmentId", "authorId")`);
    }

}
