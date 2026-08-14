import { MigrationInterface, QueryRunner } from "typeorm";

export class MobileIdAuth1786706812211 implements MigrationInterface {
    name = 'MobileIdAuth1786706812211'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Незавершённые попытки старой схемы досталось бы чинить дефолтами:
        // проще удалить их — код живёт пять минут, а пауза между запросами минуту.
        await queryRunner.query(`DELETE FROM "auth_codes"`);
        await queryRunner.query(`ALTER TABLE "auth_codes" ADD "channel" text NOT NULL DEFAULT 'code'`);
        await queryRunner.query(`ALTER TABLE "auth_codes" ADD "requestId" text`);
        await queryRunner.query(`ALTER TABLE "auth_codes" ADD "pollSecret" text NOT NULL DEFAULT ''`);
        await queryRunner.query(`ALTER TABLE "auth_codes" ADD "lastPollAt" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "auth_codes" ALTER COLUMN "code" DROP NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DELETE FROM "auth_codes" WHERE "code" IS NULL`);
        await queryRunner.query(`ALTER TABLE "auth_codes" ALTER COLUMN "code" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "auth_codes" DROP COLUMN "lastPollAt"`);
        await queryRunner.query(`ALTER TABLE "auth_codes" DROP COLUMN "pollSecret"`);
        await queryRunner.query(`ALTER TABLE "auth_codes" DROP COLUMN "requestId"`);
        await queryRunner.query(`ALTER TABLE "auth_codes" DROP COLUMN "channel"`);
    }

}
