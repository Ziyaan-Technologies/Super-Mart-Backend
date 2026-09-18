import { MigrationInterface, QueryRunner } from "typeorm";

export class PointOfSale1789644569966 implements MigrationInterface {
    name = 'PointOfSale1789644569966'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`register_sessions\` (\`id\` int NOT NULL AUTO_INCREMENT, \`session_number\` varchar(255) NULL, \`status\` enum ('Open', 'Closed') NOT NULL DEFAULT 'Open', \`opening_cash\` decimal(20,2) NOT NULL DEFAULT '0.00', \`expected_cash\` decimal(20,2) NULL, \`closing_cash\` decimal(20,2) NULL, \`cash_difference\` decimal(20,2) NULL, \`note\` text NULL, \`opened_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP, \`closed_at\` timestamp NULL, \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`vendor_id\` int NULL, \`clientstore_id\` int NULL, \`cashier_id\` int NULL, INDEX \`IDX_register_sessions_cashier_status\` (\`cashier_id\`, \`status\`), UNIQUE INDEX \`IDX_89b1945703080d45aca28db997\` (\`session_number\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`sale_items\` (\`id\` int NOT NULL AUTO_INCREMENT, \`product_name\` varchar(255) NOT NULL, \`variant_name\` varchar(255) NOT NULL, \`sku\` varchar(255) NOT NULL, \`unit_label\` varchar(255) NULL, \`quantity\` decimal(18,3) NOT NULL, \`unit_price\` decimal(20,2) NOT NULL, \`discount_amount\` decimal(20,2) NOT NULL DEFAULT '0.00', \`bill_discount_share\` decimal(20,2) NOT NULL DEFAULT '0.00', \`tax_rate\` decimal(5,2) NOT NULL DEFAULT '0.00', \`price_includes_tax\` tinyint NOT NULL DEFAULT 1, \`tax_amount\` decimal(20,2) NOT NULL DEFAULT '0.00', \`line_total\` decimal(20,2) NOT NULL DEFAULT '0.00', \`unit_cost\` decimal(20,4) NOT NULL DEFAULT '0.0000', \`returned_quantity\` decimal(18,3) NOT NULL DEFAULT '0.000', \`sale_id\` int NULL, \`product_variant_id\` int NULL, PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`sale_payments\` (\`id\` int NOT NULL AUTO_INCREMENT, \`method\` enum ('Cash', 'Card', 'Mobile Wallet', 'Bank Transfer') NOT NULL, \`amount\` decimal(20,2) NOT NULL, \`reference\` varchar(255) NULL, \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`sale_id\` int NULL, PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`sales\` (\`id\` int NOT NULL AUTO_INCREMENT, \`bill_number\` varchar(255) NULL, \`customer_name\` varchar(255) NULL, \`customer_phone\` varchar(255) NULL, \`status\` enum ('Completed', 'Partially Returned', 'Returned') NOT NULL DEFAULT 'Completed', \`item_count\` decimal(18,3) NOT NULL DEFAULT '0.000', \`subtotal\` decimal(20,2) NOT NULL DEFAULT '0.00', \`item_discount\` decimal(20,2) NOT NULL DEFAULT '0.00', \`bill_discount\` decimal(20,2) NOT NULL DEFAULT '0.00', \`tax_amount\` decimal(20,2) NOT NULL DEFAULT '0.00', \`total_amount\` decimal(20,2) NOT NULL DEFAULT '0.00', \`paid_amount\` decimal(20,2) NOT NULL DEFAULT '0.00', \`change_amount\` decimal(20,2) NOT NULL DEFAULT '0.00', \`refunded_amount\` decimal(20,2) NOT NULL DEFAULT '0.00', \`cost_amount\` decimal(20,2) NOT NULL DEFAULT '0.00', \`note\` text NULL, \`print_count\` int NOT NULL DEFAULT '0', \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`vendor_id\` int NULL, \`clientstore_id\` int NULL, \`register_session_id\` int NULL, \`cashier_id\` int NULL, \`user_id\` int NULL, INDEX \`IDX_sales_store_date\` (\`clientstore_id\`, \`created_at\`), UNIQUE INDEX \`IDX_9e38d3b7b75ab9df957c7337b0\` (\`bill_number\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`sale_return_items\` (\`id\` int NOT NULL AUTO_INCREMENT, \`quantity\` decimal(18,3) NOT NULL, \`refund_amount\` decimal(20,2) NOT NULL DEFAULT '0.00', \`sale_return_id\` int NULL, \`sale_item_id\` int NULL, PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`sale_returns\` (\`id\` int NOT NULL AUTO_INCREMENT, \`return_number\` varchar(255) NULL, \`refund_method\` enum ('Cash', 'Card', 'Mobile Wallet', 'Bank Transfer') NOT NULL, \`refund_amount\` decimal(20,2) NOT NULL DEFAULT '0.00', \`reason\` varchar(255) NULL, \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`sale_id\` int NULL, \`vendor_id\` int NULL, \`clientstore_id\` int NULL, \`register_session_id\` int NULL, \`processed_by_id\` int NULL, UNIQUE INDEX \`IDX_3bacd8df5e511f3744c0c54b1b\` (\`return_number\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`ALTER TABLE \`register_sessions\` ADD CONSTRAINT \`FK_4af9d31246d6a31da13b71b1b56\` FOREIGN KEY (\`vendor_id\`) REFERENCES \`vendors\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`register_sessions\` ADD CONSTRAINT \`FK_f49bddfb5d6d8983a31e73bdcaa\` FOREIGN KEY (\`clientstore_id\`) REFERENCES \`client_stores\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`register_sessions\` ADD CONSTRAINT \`FK_929ab6057d9020a9bc21dd96ea4\` FOREIGN KEY (\`cashier_id\`) REFERENCES \`clients\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`sale_items\` ADD CONSTRAINT \`FK_c210a330b80232c29c2ad68462a\` FOREIGN KEY (\`sale_id\`) REFERENCES \`sales\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`sale_items\` ADD CONSTRAINT \`FK_6cc4a023710b89bf3f48c2a47e9\` FOREIGN KEY (\`product_variant_id\`) REFERENCES \`product_variants\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`sale_payments\` ADD CONSTRAINT \`FK_0e4445597642c2456ebdd7e23b1\` FOREIGN KEY (\`sale_id\`) REFERENCES \`sales\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`sales\` ADD CONSTRAINT \`FK_931b8c73a5943d6559244eda062\` FOREIGN KEY (\`vendor_id\`) REFERENCES \`vendors\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`sales\` ADD CONSTRAINT \`FK_97b861daa9039a9619cd567bde5\` FOREIGN KEY (\`clientstore_id\`) REFERENCES \`client_stores\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`sales\` ADD CONSTRAINT \`FK_1a7d1f48393a5fb58625ac5bd38\` FOREIGN KEY (\`register_session_id\`) REFERENCES \`register_sessions\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`sales\` ADD CONSTRAINT \`FK_52ad26d289eda84215d133ff0f8\` FOREIGN KEY (\`cashier_id\`) REFERENCES \`clients\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`sales\` ADD CONSTRAINT \`FK_5f282f3656814ec9ca2675aef6f\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`sale_return_items\` ADD CONSTRAINT \`FK_fee3a82ea330b3b8df0b41fc5da\` FOREIGN KEY (\`sale_return_id\`) REFERENCES \`sale_returns\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`sale_return_items\` ADD CONSTRAINT \`FK_07250d0eb513a2f1b30b6c8e4bc\` FOREIGN KEY (\`sale_item_id\`) REFERENCES \`sale_items\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`sale_returns\` ADD CONSTRAINT \`FK_2b61a5fa8b873de80fd16331667\` FOREIGN KEY (\`sale_id\`) REFERENCES \`sales\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`sale_returns\` ADD CONSTRAINT \`FK_f7c192b4806b6f4ad84ab0c317e\` FOREIGN KEY (\`vendor_id\`) REFERENCES \`vendors\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`sale_returns\` ADD CONSTRAINT \`FK_6ba3c7e43dc0a737481e4b101e2\` FOREIGN KEY (\`clientstore_id\`) REFERENCES \`client_stores\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`sale_returns\` ADD CONSTRAINT \`FK_2a9669697bc934549460eb92be2\` FOREIGN KEY (\`register_session_id\`) REFERENCES \`register_sessions\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`sale_returns\` ADD CONSTRAINT \`FK_7a1d98bf35e97708267880814a3\` FOREIGN KEY (\`processed_by_id\`) REFERENCES \`clients\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`sale_returns\` DROP FOREIGN KEY \`FK_7a1d98bf35e97708267880814a3\``);
        await queryRunner.query(`ALTER TABLE \`sale_returns\` DROP FOREIGN KEY \`FK_2a9669697bc934549460eb92be2\``);
        await queryRunner.query(`ALTER TABLE \`sale_returns\` DROP FOREIGN KEY \`FK_6ba3c7e43dc0a737481e4b101e2\``);
        await queryRunner.query(`ALTER TABLE \`sale_returns\` DROP FOREIGN KEY \`FK_f7c192b4806b6f4ad84ab0c317e\``);
        await queryRunner.query(`ALTER TABLE \`sale_returns\` DROP FOREIGN KEY \`FK_2b61a5fa8b873de80fd16331667\``);
        await queryRunner.query(`ALTER TABLE \`sale_return_items\` DROP FOREIGN KEY \`FK_07250d0eb513a2f1b30b6c8e4bc\``);
        await queryRunner.query(`ALTER TABLE \`sale_return_items\` DROP FOREIGN KEY \`FK_fee3a82ea330b3b8df0b41fc5da\``);
        await queryRunner.query(`ALTER TABLE \`sales\` DROP FOREIGN KEY \`FK_5f282f3656814ec9ca2675aef6f\``);
        await queryRunner.query(`ALTER TABLE \`sales\` DROP FOREIGN KEY \`FK_52ad26d289eda84215d133ff0f8\``);
        await queryRunner.query(`ALTER TABLE \`sales\` DROP FOREIGN KEY \`FK_1a7d1f48393a5fb58625ac5bd38\``);
        await queryRunner.query(`ALTER TABLE \`sales\` DROP FOREIGN KEY \`FK_97b861daa9039a9619cd567bde5\``);
        await queryRunner.query(`ALTER TABLE \`sales\` DROP FOREIGN KEY \`FK_931b8c73a5943d6559244eda062\``);
        await queryRunner.query(`ALTER TABLE \`sale_payments\` DROP FOREIGN KEY \`FK_0e4445597642c2456ebdd7e23b1\``);
        await queryRunner.query(`ALTER TABLE \`sale_items\` DROP FOREIGN KEY \`FK_6cc4a023710b89bf3f48c2a47e9\``);
        await queryRunner.query(`ALTER TABLE \`sale_items\` DROP FOREIGN KEY \`FK_c210a330b80232c29c2ad68462a\``);
        await queryRunner.query(`ALTER TABLE \`register_sessions\` DROP FOREIGN KEY \`FK_929ab6057d9020a9bc21dd96ea4\``);
        await queryRunner.query(`ALTER TABLE \`register_sessions\` DROP FOREIGN KEY \`FK_f49bddfb5d6d8983a31e73bdcaa\``);
        await queryRunner.query(`ALTER TABLE \`register_sessions\` DROP FOREIGN KEY \`FK_4af9d31246d6a31da13b71b1b56\``);
        await queryRunner.query(`DROP INDEX \`IDX_3bacd8df5e511f3744c0c54b1b\` ON \`sale_returns\``);
        await queryRunner.query(`DROP TABLE \`sale_returns\``);
        await queryRunner.query(`DROP TABLE \`sale_return_items\``);
        await queryRunner.query(`DROP INDEX \`IDX_9e38d3b7b75ab9df957c7337b0\` ON \`sales\``);
        await queryRunner.query(`DROP INDEX \`IDX_sales_store_date\` ON \`sales\``);
        await queryRunner.query(`DROP TABLE \`sales\``);
        await queryRunner.query(`DROP TABLE \`sale_payments\``);
        await queryRunner.query(`DROP TABLE \`sale_items\``);
        await queryRunner.query(`DROP INDEX \`IDX_89b1945703080d45aca28db997\` ON \`register_sessions\``);
        await queryRunner.query(`DROP INDEX \`IDX_register_sessions_cashier_status\` ON \`register_sessions\``);
        await queryRunner.query(`DROP TABLE \`register_sessions\``);
    }

}
