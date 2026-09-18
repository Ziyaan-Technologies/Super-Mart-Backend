import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, RelationId } from "typeorm";
import { DecimalTransformer } from "src/common/decimal.transformer";
import { Sale } from "./sale.entity";
import { Bank } from "src/bank/models/bank.entity";

export enum PaymentMethod {
  CASH = 'Cash',
  CARD = 'Card',
  ONLINE = 'Online',
}

@Entity('sale_payments')
export class SalePayment {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Sale, sale => sale.payments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sale_id' })
  sale: Sale;

  @RelationId((payment: SalePayment) => payment.sale)
  sale_id: number;

  @Column({
    type: 'enum',
    enum: PaymentMethod,
  })
  method: PaymentMethod;

  @Column({ type: 'decimal', precision: 20, scale: 2, transformer: DecimalTransformer })
  amount: number;

  @Column({ nullable: true })
  reference: string;

  @ManyToOne(() => Bank, { nullable: true })
  @JoinColumn({ name: 'bank_id' })
  bank: Bank;

  @RelationId((payment: SalePayment) => payment.bank)
  bank_id: number;

  @Column({ nullable: true })
  bank_name: string;

  @CreateDateColumn({ type: "timestamp", default: () => "CURRENT_TIMESTAMP(6)" })
  created_at: Date;
}
