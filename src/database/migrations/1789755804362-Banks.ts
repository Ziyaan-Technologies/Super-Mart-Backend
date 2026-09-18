import { MigrationInterface, QueryRunner } from "typeorm";

export class Banks1789755804362 implements MigrationInterface {
    name = 'Banks1789755804362'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`banks\` (\`id\` int NOT NULL AUTO_INCREMENT, \`name\` varchar(255) NOT NULL, \`is_active\` tinyint NOT NULL DEFAULT 1, \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deleted_at\` datetime(6) NULL, \`vendor_id\` int NULL, PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`ALTER TABLE \`sale_payments\` ADD \`bank_name\` varchar(255) NULL`);
        await queryRunner.query(`ALTER TABLE \`sale_payments\` ADD \`bank_id\` int NULL`);
        await queryRunner.query(`ALTER TABLE \`banks\` ADD CONSTRAINT \`FK_18e5fc36bf38a7296477b13e351\` FOREIGN KEY (\`vendor_id\`) REFERENCES \`vendors\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`sale_payments\` ADD CONSTRAINT \`FK_8158787a0a38b28b2bd8a78140e\` FOREIGN KEY (\`bank_id\`) REFERENCES \`banks\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`sale_payments\` DROP FOREIGN KEY \`FK_8158787a0a38b28b2bd8a78140e\``);
        await queryRunner.query(`ALTER TABLE \`banks\` DROP FOREIGN KEY \`FK_18e5fc36bf38a7296477b13e351\``);
        await queryRunner.query(`ALTER TABLE \`sale_payments\` DROP COLUMN \`bank_id\``);
        await queryRunner.query(`ALTER TABLE \`sale_payments\` DROP COLUMN \`bank_name\``);
        await queryRunner.query(`DROP TABLE \`banks\``);
    }

}
