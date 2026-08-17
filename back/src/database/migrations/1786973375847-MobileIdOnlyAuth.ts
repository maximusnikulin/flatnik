import { MigrationInterface, QueryRunner } from "typeorm";

export class MobileIdOnlyAuth1786973375847 implements MigrationInterface {
    name = 'MobileIdOnlyAuth1786973375847'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Запасной путь с нашим кодом убран: одноразовый код теперь выпускает и
        // проверяет провайдер, поэтому колонкам code и channel нечем жить.
        // Незавершённые попытки удаляем — попытка живёт пять минут, а пауза
        // между запросами минуту, чинить их дефолтами дороже, чем потерять.
        await queryRunner.query(`DELETE FROM "auth_codes"`);
        await queryRunner.query(`ALTER TABLE "auth_codes" DROP COLUMN "code"`);
        await queryRunner.query(`ALTER TABLE "auth_codes" DROP COLUMN "channel"`);
        await queryRunner.query(`ALTER TABLE "auth_codes" ADD "providerStatus" integer NOT NULL DEFAULT 0`);
        await queryRunner.query(`ALTER TABLE "auth_codes" ADD "needsRecheck" boolean NOT NULL DEFAULT false`);
        // Путь остался один, заявка есть всегда — requestId больше не nullable
        await queryRunner.query(`ALTER TABLE "auth_codes" ALTER COLUMN "requestId" SET NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DELETE FROM "auth_codes"`);
        await queryRunner.query(`ALTER TABLE "auth_codes" ALTER COLUMN "requestId" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "auth_codes" DROP COLUMN "needsRecheck"`);
        await queryRunner.query(`ALTER TABLE "auth_codes" DROP COLUMN "providerStatus"`);
        await queryRunner.query(`ALTER TABLE "auth_codes" ADD "channel" text NOT NULL DEFAULT 'code'`);
        await queryRunner.query(`ALTER TABLE "auth_codes" ADD "code" text`);
    }

}
