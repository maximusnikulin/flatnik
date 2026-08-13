import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1786631001216 implements MigrationInterface {
    name = 'InitialSchema1786631001216'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // uuid_generate_v4() ниже живёт в этом расширении. Драйвер TypeORM
        // создаёт его сам при подключении, но полагаться на побочный эффект
        // подключения не стоит: миграция должна применяться на голой базе.
        await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
        await queryRunner.query(`CREATE TABLE "houses" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "address" text NOT NULL, "addressKey" text NOT NULL, "lat" double precision NOT NULL, "lon" double precision NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_25cffa2c198a9e18b751b80234b" UNIQUE ("addressKey"), CONSTRAINT "PK_ee6cacb502a4b8590005eb3dc8d" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "apartments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "houseId" uuid NOT NULL, "number" text NOT NULL, "entrance" text NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_000bd87441b8b185a89485577e4" UNIQUE ("houseId", "number"), CONSTRAINT "PK_f6058e85d6d715dbe22b72fe722" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "phone" text NOT NULL, "nickname" text NOT NULL, "nicknameLower" text NOT NULL, "nicknameConfirmed" boolean NOT NULL DEFAULT false, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_a000cca60bcf04454e727699490" UNIQUE ("phone"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_947f9274ee50d209b8e423d854" ON "users"  ("nicknameLower") `);
        await queryRunner.query(`CREATE TYPE "public"."reviews_status_enum" AS ENUM('pending', 'confirmed')`);
        await queryRunner.query(`CREATE TABLE "reviews" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "apartmentId" uuid NOT NULL, "authorId" uuid NOT NULL, "egrn" text NOT NULL, "text" text NOT NULL, "periodFrom" date, "periodTo" date, "status" "public"."reviews_status_enum" NOT NULL DEFAULT 'pending', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_231ae565c273ee700b283f15c1d" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "apartments" ADD CONSTRAINT "FK_7f0a07f7204c5618e273d08f959" FOREIGN KEY ("houseId") REFERENCES "houses"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "reviews" ADD CONSTRAINT "FK_c2136fd08c4f86570ae5f09557b" FOREIGN KEY ("apartmentId") REFERENCES "apartments"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "reviews" ADD CONSTRAINT "FK_48770372f891b9998360e4434f3" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "reviews" DROP CONSTRAINT "FK_48770372f891b9998360e4434f3"`);
        await queryRunner.query(`ALTER TABLE "reviews" DROP CONSTRAINT "FK_c2136fd08c4f86570ae5f09557b"`);
        await queryRunner.query(`ALTER TABLE "apartments" DROP CONSTRAINT "FK_7f0a07f7204c5618e273d08f959"`);
        await queryRunner.query(`DROP TABLE "reviews"`);
        await queryRunner.query(`DROP TYPE "public"."reviews_status_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_947f9274ee50d209b8e423d854"`);
        await queryRunner.query(`DROP TABLE "users"`);
        await queryRunner.query(`DROP TABLE "apartments"`);
        await queryRunner.query(`DROP TABLE "houses"`);
    }

}
