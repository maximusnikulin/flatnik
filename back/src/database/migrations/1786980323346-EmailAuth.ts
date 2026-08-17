import { MigrationInterface, QueryRunner } from "typeorm";

export class EmailAuth1786980323346 implements MigrationInterface {
    name = 'EmailAuth1786980323346'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Войти теперь можно и по почте, поэтому телефон перестаёт быть
        // обязательным. Уникальность остаётся: NULL в Postgres не конфликтуют.
        await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "phone" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "users" ADD "email" text`);
        await queryRunner.query(`ALTER TABLE "users" ADD CONSTRAINT "UQ_users_email" UNIQUE ("email")`);

        // Попытка входа теперь бывает трёх видов, и назначение входит в ключ:
        // иначе начатая привязка почты затирала бы чужой вход по той же почте.
        // Таблица временная (TTL 5 минут) — незавершённые попытки просто теряем.
        await queryRunner.query(`DELETE FROM "auth_codes"`);
        await queryRunner.query(`ALTER TABLE "auth_codes" DROP CONSTRAINT "PK_de6c34d7e542cdfe11e02ca0d15"`);
        await queryRunner.query(`ALTER TABLE "auth_codes" RENAME COLUMN "phone" TO "identifier"`);
        await queryRunner.query(`ALTER TABLE "auth_codes" ADD "kind" text NOT NULL DEFAULT 'phone'`);
        await queryRunner.query(`ALTER TABLE "auth_codes" ADD CONSTRAINT "PK_auth_codes" PRIMARY KEY ("identifier", "kind")`);
        // Свой код вернулся — но только для почты: у телефона его знает провайдер
        await queryRunner.query(`ALTER TABLE "auth_codes" ADD "code" text`);
        await queryRunner.query(`ALTER TABLE "auth_codes" ALTER COLUMN "requestId" DROP NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DELETE FROM "auth_codes"`);
        await queryRunner.query(`ALTER TABLE "auth_codes" ALTER COLUMN "requestId" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "auth_codes" DROP COLUMN "code"`);
        await queryRunner.query(`ALTER TABLE "auth_codes" DROP CONSTRAINT "PK_auth_codes"`);
        await queryRunner.query(`ALTER TABLE "auth_codes" DROP COLUMN "kind"`);
        await queryRunner.query(`ALTER TABLE "auth_codes" RENAME COLUMN "identifier" TO "phone"`);
        await queryRunner.query(`ALTER TABLE "auth_codes" ADD CONSTRAINT "PK_de6c34d7e542cdfe11e02ca0d15" PRIMARY KEY ("phone")`);

        // Аккаунты без телефона откату мешают — их некуда деть, кроме удаления
        await queryRunner.query(`DELETE FROM "users" WHERE "phone" IS NULL`);
        await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "UQ_users_email"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "email"`);
        await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "phone" SET NOT NULL`);
    }

}
