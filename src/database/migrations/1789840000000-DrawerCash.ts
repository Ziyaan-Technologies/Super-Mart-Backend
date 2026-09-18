import { MigrationInterface, QueryRunner } from "typeorm";

export class DrawerCash1789840000000 implements MigrationInterface {
    name = 'DrawerCash1789840000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`client_stores\` ADD \`drawer_cash\` decimal(20,2) NOT NULL DEFAULT '0.00'`);
        await queryRunner.query(`UPDATE \`client_stores\` cs SET cs.\`drawer_cash\` = COALESCE((SELECT rs.\`closing_cash\` FROM \`register_sessions\` rs WHERE rs.\`clientstore_id\` = cs.\`id\` AND rs.\`status\` = 'Closed' ORDER BY rs.\`closed_at\` DESC, rs.\`id\` DESC LIMIT 1), 0)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`client_stores\` DROP COLUMN \`drawer_cash\``);
    }

}
