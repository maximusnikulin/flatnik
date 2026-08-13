import { MigrationInterface, QueryRunner } from "typeorm";

export class AuthCodes1786645699752 implements MigrationInterface {
    name = 'AuthCodes1786645699752'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "auth_codes" ("phone" text NOT NULL, "code" text NOT NULL, "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL, "nextRequestAt" TIMESTAMP WITH TIME ZONE NOT NULL, "attempts" integer NOT NULL DEFAULT '0', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_de6c34d7e542cdfe11e02ca0d15" PRIMARY KEY ("phone"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "auth_codes"`);
    }

}
