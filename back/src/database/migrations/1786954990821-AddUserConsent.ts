import { MigrationInterface, QueryRunner } from "typeorm";

export class AddUserConsent1786954990821 implements MigrationInterface {
    name = 'AddUserConsent1786954990821'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" ADD "consentAcceptedAt" TIMESTAMP WITH TIME ZONE`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "consentAcceptedAt"`);
    }

}
