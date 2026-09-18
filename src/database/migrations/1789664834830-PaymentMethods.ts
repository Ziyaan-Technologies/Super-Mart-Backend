import { MigrationInterface, QueryRunner } from "typeorm";

export class PaymentMethods1789664834830 implements MigrationInterface {
    name = 'PaymentMethods1789664834830'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`sale_payments\` MODIFY \`method\` enum ('Cash', 'Card', 'Mobile Wallet', 'Bank Transfer', 'Online') NOT NULL`);
        await queryRunner.query(`ALTER TABLE \`sale_returns\` MODIFY \`refund_method\` enum ('Cash', 'Card', 'Mobile Wallet', 'Bank Transfer', 'Online') NOT NULL`);
        await queryRunner.query(`UPDATE \`sale_payments\` SET \`method\` = 'Online' WHERE \`method\` IN ('Mobile Wallet', 'Bank Transfer')`);
        await queryRunner.query(`UPDATE \`sale_returns\` SET \`refund_method\` = 'Online' WHERE \`refund_method\` IN ('Mobile Wallet', 'Bank Transfer')`);
        await queryRunner.query(`ALTER TABLE \`sale_payments\` MODIFY \`method\` enum ('Cash', 'Card', 'Online') NOT NULL`);
        await queryRunner.query(`ALTER TABLE \`sale_returns\` MODIFY \`refund_method\` enum ('Cash', 'Card', 'Online') NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`sale_returns\` MODIFY \`refund_method\` enum ('Cash', 'Card', 'Mobile Wallet', 'Bank Transfer', 'Online') NOT NULL`);
        await queryRunner.query(`ALTER TABLE \`sale_payments\` MODIFY \`method\` enum ('Cash', 'Card', 'Mobile Wallet', 'Bank Transfer', 'Online') NOT NULL`);
        await queryRunner.query(`UPDATE \`sale_returns\` SET \`refund_method\` = 'Bank Transfer' WHERE \`refund_method\` = 'Online'`);
        await queryRunner.query(`UPDATE \`sale_payments\` SET \`method\` = 'Bank Transfer' WHERE \`method\` = 'Online'`);
        await queryRunner.query(`ALTER TABLE \`sale_returns\` MODIFY \`refund_method\` enum ('Cash', 'Card', 'Mobile Wallet', 'Bank Transfer') NOT NULL`);
        await queryRunner.query(`ALTER TABLE \`sale_payments\` MODIFY \`method\` enum ('Cash', 'Card', 'Mobile Wallet', 'Bank Transfer') NOT NULL`);
    }
}
