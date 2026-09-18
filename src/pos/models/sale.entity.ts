import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, RelationId, UpdateDateColumn } from "typeorm";
import { Vendor } from "src/vendor/models/vendor.entity";
import { Clientstore } from "src/clientstore/models/clientstore.entity";
import { Client } from "src/client/models/client.entity";
import { User } from "src/user/models/user.entity";
import { DecimalTransformer } from "src/common/decimal.transformer";
import { RegisterSession } from "./register-session.entity";
import { SaleItem } from "./sale-item.entity";
import { SalePayment } from "./sale-payment.entity";

export enum SaleStatus {
  COMPLETED = 'Completed',
  PARTIALLY_RETURNED = 'Partially Returned',
  RETURNED = 'Returned',
}

@Entity('sales')
@Index('IDX_sales_store_date', ['clientstore', 'created_at'])
export class Sale {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true, nullable: true })
  bill_number: string;

  @ManyToOne(() => Vendor)
  @JoinColumn({ name: 'vendor_id' })
  vendor: Vendor;

  @RelationId((sale: Sale) => sale.vendor)
  vendor_id: number;

  @ManyToOne(() => Clientstore)
  @JoinColumn({ name: 'clientstore_id' })
  clientstore: Clientstore;

  @RelationId((sale: Sale) => sale.clientstore)
  clientstore_id: number;

  @ManyToOne(() => RegisterSession, { nullable: true })
  @JoinColumn({ name: 'register_session_id' })
  register_session: RegisterSession;

  @RelationId((sale: Sale) => sale.register_session)
  register_session_id: number;

  @ManyToOne(() => Client)
  @JoinColumn({ name: 'cashier_id' })
  cashier: Client;

  @RelationId((sale: Sale) => sale.cashier)
  cashier_id: number;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'user_id' })
  customer: User;

  @RelationId((sale: Sale) => sale.customer)
  user_id: number;

  @Column({ nullable: true })
  customer_name: string;

  @Column({ nullable: true })
  customer_phone: string;

  @OneToMany(() => SaleItem, item => item.sale)
  items: SaleItem[];

  @OneToMany(() => SalePayment, payment => payment.sale)
  payments: SalePayment[];

  @Column({
    type: 'enum',
    enum: SaleStatus,
    default: SaleStatus.COMPLETED
  })
  status: SaleStatus;

  @Column({ type: 'decimal', precision: 18, scale: 3, default: 0, transformer: DecimalTransformer })
  item_count: number;

  @Column({ type: 'decimal', precision: 20, scale: 2, default: 0, transformer: DecimalTransformer })
  subtotal: number;

  @Column({ type: 'decimal', precision: 20, scale: 2, default: 0, transformer: DecimalTransformer })
  item_discount: number;

  @Column({ type: 'decimal', precision: 20, scale: 2, default: 0, transformer: DecimalTransformer })
  bill_discount: number;

  @Column({ type: 'decimal', precision: 20, scale: 2, default: 0, transformer: DecimalTransformer })
  tax_amount: number;

  @Column({ type: 'decimal', precision: 20, scale: 2, default: 0, transformer: DecimalTransformer })
  total_amount: number;

  @Column({ type: 'decimal', precision: 20, scale: 2, default: 0, transformer: DecimalTransformer })
  paid_amount: number;

  @Column({ type: 'decimal', precision: 20, scale: 2, default: 0, transformer: DecimalTransformer })
  change_amount: number;

  @Column({ type: 'decimal', precision: 20, scale: 2, default: 0, transformer: DecimalTransformer })
  refunded_amount: number;

  @Column({ type: 'decimal', precision: 20, scale: 2, default: 0, transformer: DecimalTransformer })
  cost_amount: number;

  @Column({ type: 'text', nullable: true })
  note: string;

  @Column({ default: 0 })
  print_count: number;

  @CreateDateColumn({ type: "timestamp", default: () => "CURRENT_TIMESTAMP(6)" })
  created_at: Date;

  @UpdateDateColumn({ type: "timestamp", default: () => "CURRENT_TIMESTAMP(6)", onUpdate: "CURRENT_TIMESTAMP(6)" })
  updated_at: Date;
}
