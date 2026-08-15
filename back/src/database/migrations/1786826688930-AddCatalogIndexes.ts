import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCatalogIndexes1786826688930 implements MigrationInterface {
    name = 'AddCatalogIndexes1786826688930'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE INDEX "IDX_b9baad155f5a285f33bbe6c871" ON "reviews"  ("apartmentId", "status") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_b9baad155f5a285f33bbe6c871"`);
    }

}
