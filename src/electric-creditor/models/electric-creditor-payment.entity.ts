import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, RelationId } from 'typeorm';
import { DecimalTransformer } from 'src/common/decimal.transformer';
import { Client } from 'src/client/models/client.entity';
import { Clientstore } from 'src/clientstore/models/clientstore.entity';
import { Vendor } from 'src/vendor/models/vendor.entity';
import { ElectricCounter } from 'src/electric-counter/models/electric-counter.entity';
import { ElectricCounterSession } from 'src/electric-counter/models/electric-counter-session.entity';
import { ElectricPaymentMethod } from 'src/electric-sale/models/electric-sale.entity';
import { ElectricCreditor } from './electric-creditor.entity';

@Entity('electric_creditor_payments')
export class ElectricCreditorPayment {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => ElectricCreditor, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'creditor_id' })
  creditor: ElectricCreditor;

  @RelationId((payment: ElectricCreditorPayment) => payment.creditor)
  creditor_id: number;

  @ManyToOne(() => Vendor, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'vendor_id' })
  vendor: Vendor;

  @RelationId((payment: ElectricCreditorPayment) => payment.vendor)
  vendor_id: number;

  @ManyToOne(() => Clientstore, { nullable: true })
  @JoinColumn({ name: 'clientstore_id' })
  clientstore: Clientstore;

  @RelationId((payment: ElectricCreditorPayment) => payment.clientstore)
  clientstore_id: number;

  @ManyToOne(() => ElectricCounter, { nullable: true })
  @JoinColumn({ name: 'counter_id' })
  counter: ElectricCounter;

  @RelationId((payment: ElectricCreditorPayment) => payment.counter)
  counter_id: number;

  @ManyToOne(() => ElectricCounterSession, { nullable: true })
  @JoinColumn({ name: 'session_id' })
  session: ElectricCounterSession;

  @RelationId((payment: ElectricCreditorPayment) => payment.session)
  session_id: number;

  @Column({ type: 'decimal', precision: 20, scale: 2, default: 0, transformer: DecimalTransformer })
  amount: number;

  @Column({ type: 'enum', enum: ElectricPaymentMethod, default: ElectricPaymentMethod.CASH })
  method: ElectricPaymentMethod;

  @Column({ type: 'text', nullable: true })
  note: string;

  @ManyToOne(() => Client, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'paid_by' })
  paid_by_client: Client;

  @RelationId((payment: ElectricCreditorPayment) => payment.paid_by_client)
  paid_by: number;

  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP(6)' })
  created_at: Date;
}
