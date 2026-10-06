import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, RelationId, UpdateDateColumn } from 'typeorm';
import { Vendor } from 'src/vendor/models/vendor.entity';
import { Clientstore } from 'src/clientstore/models/clientstore.entity';
import { Client } from 'src/client/models/client.entity';
import { DecimalTransformer } from 'src/common/decimal.transformer';
import { ElectricCounter } from 'src/electric-counter/models/electric-counter.entity';
import { ElectricCounterSession } from 'src/electric-counter/models/electric-counter-session.entity';
import { ElectricDocumentTotals } from 'src/common/electric-document.entity';
import { ElectricSaleItem } from './electric-sale-item.entity';

export enum ElectricPaymentMethod {
  CASH = 'Cash',
  CARD = 'Card',
  ONLINE = 'Online',
}

export enum ElectricSaleStatus {
  COMPLETED = 'Completed',
  PARTIALLY_RETURNED = 'Partially Returned',
  RETURNED = 'Returned',
}

@Entity('electric_sales')
export class ElectricSale extends ElectricDocumentTotals {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  bill_number: string;

  @ManyToOne(() => Vendor)
  @JoinColumn({ name: 'vendor_id' })
  vendor: Vendor;

  @RelationId((sale: ElectricSale) => sale.vendor)
  vendor_id: number;

  @ManyToOne(() => Clientstore)
  @JoinColumn({ name: 'clientstore_id' })
  clientstore: Clientstore;

  @RelationId((sale: ElectricSale) => sale.clientstore)
  clientstore_id: number;

  @ManyToOne(() => ElectricCounter)
  @JoinColumn({ name: 'counter_id' })
  counter: ElectricCounter;

  @RelationId((sale: ElectricSale) => sale.counter)
  counter_id: number;

  @ManyToOne(() => ElectricCounterSession)
  @JoinColumn({ name: 'session_id' })
  session: ElectricCounterSession;

  @RelationId((sale: ElectricSale) => sale.session)
  session_id: number;

  @ManyToOne(() => Client)
  @JoinColumn({ name: 'cashier_id' })
  cashier: Client;

  @RelationId((sale: ElectricSale) => sale.cashier)
  cashier_id: number;

  @Column({ nullable: true })
  quotation_id: number;

  @Column({ type: 'enum', enum: ElectricPaymentMethod, default: ElectricPaymentMethod.CASH })
  payment_method: ElectricPaymentMethod;

  @Column({ type: 'decimal', precision: 20, scale: 2, default: 0, transformer: DecimalTransformer })
  amount_received: number;

  @Column({ type: 'decimal', precision: 20, scale: 2, default: 0, transformer: DecimalTransformer })
  change_amount: number;

  @Column({ type: 'decimal', precision: 20, scale: 2, default: 0, transformer: DecimalTransformer })
  paid_amount: number;

  @Column({ type: 'date', nullable: true })
  due_date: string;

  @Column({ type: 'decimal', precision: 20, scale: 2, default: 0, transformer: DecimalTransformer })
  khata_amount: number;

  @Column({ type: 'decimal', precision: 20, scale: 2, default: 0, transformer: DecimalTransformer })
  refunded_amount: number;

  @Column({ type: 'timestamp', nullable: true })
  edited_at: Date;

  @Column({ nullable: true })
  edited_by: number;

  @Column({ type: 'enum', enum: ElectricSaleStatus, default: ElectricSaleStatus.COMPLETED })
  status: ElectricSaleStatus;

  @OneToMany(() => ElectricSaleItem, (item) => item.sale)
  items: ElectricSaleItem[];

  @CreateDateColumn({ type: "timestamp", default: () => "CURRENT_TIMESTAMP(6)" })
  created_at: Date;

  @UpdateDateColumn({ type: "timestamp", default: () => "CURRENT_TIMESTAMP(6)", onUpdate: "CURRENT_TIMESTAMP(6)" })
  updated_at: Date;
}
