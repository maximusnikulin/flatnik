import { MigrationInterface, QueryRunner } from "typeorm";
import { buildHouseSlugs } from "../../houses/address-slug.util";

/** Строка домов, какой её видит бэкфилл */
interface HouseRow {
    id: string
    address: string
}

export class AddHouseSlugs1786826403754 implements MigrationInterface {
    name = 'AddHouseSlugs1786826403754'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "houses" ADD "citySlug" text`);
        await queryRunner.query(`ALTER TABLE "houses" ADD "cityName" text`);
        await queryRunner.query(`ALTER TABLE "houses" ADD "streetSlug" text`);
        await queryRunner.query(`ALTER TABLE "houses" ADD "streetName" text`);
        await queryRunner.query(`ALTER TABLE "houses" ADD "houseSlug" text`);

        // Бэкфилл на JS, а не на SQL: транслитерация и разбор адреса на десятке
        // вложенных replace() нечитаемы и неизбежно разъедутся с версией в
        // address-slug.util.ts. Домов немного, скорость роли не играет.
        //
        // Дубликаты обязаны разъехаться ДО создания уникального индекса, иначе
        // миграция упадёт и контейнер уйдёт в перезапуск.
        const rows: HouseRow[] = await queryRunner.query(`SELECT "id", "address" FROM "houses"`);
        const taken = new Set<string>();
        for (const row of rows) {
            const slugs = buildHouseSlugs(row.address);
            if (!slugs) {
                continue;
            }
            let houseSlug = slugs.houseSlug;
            for (let attempt = 2; taken.has(`${slugs.citySlug}/${slugs.streetSlug}/${houseSlug}`); attempt++) {
                houseSlug = `${slugs.houseSlug}-${attempt}`;
            }
            taken.add(`${slugs.citySlug}/${slugs.streetSlug}/${houseSlug}`);
            await queryRunner.query(
                `UPDATE "houses" SET "citySlug" = $1, "cityName" = $2, "streetSlug" = $3, "streetName" = $4, "houseSlug" = $5 WHERE "id" = $6`,
                [slugs.citySlug, slugs.cityName, slugs.streetSlug, slugs.streetName, houseSlug, row.id],
            );
        }

        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_da61eee2dd0097c60ef6d26c06" ON "houses"  ("citySlug", "streetSlug", "houseSlug") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_da61eee2dd0097c60ef6d26c06"`);
        await queryRunner.query(`ALTER TABLE "houses" DROP COLUMN "houseSlug"`);
        await queryRunner.query(`ALTER TABLE "houses" DROP COLUMN "streetName"`);
        await queryRunner.query(`ALTER TABLE "houses" DROP COLUMN "streetSlug"`);
        await queryRunner.query(`ALTER TABLE "houses" DROP COLUMN "cityName"`);
        await queryRunner.query(`ALTER TABLE "houses" DROP COLUMN "citySlug"`);
    }

}
