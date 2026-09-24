import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, RelationId } from 'typeorm';
import { DecimalTransformer } from 'src/common/decimal.transformer';
import { Client } from 'src/client/models/client.entity';
import { Clientstore } from 'src/clientstore/models/clientstore.entity';
import { Vendor } from 'src/vendor/models/vendor.entity';
import { ElectricCounter } from 'src/electric-counter/models/electric-counter.entity';
import { ElectricCounterSession } from 'src/electric-counter/models/electric-counter-session.entity';
import { ElectricPaymentMethod } from 'src/electric-sale/models/electric-sale.entity';
import { ElectricDebtor } from './electric-debtor.entity';

@Entity('electric_debtor_payments')
export class ElectricDebtorPayment {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => ElectricDebtor, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'debtor_id' })
  debtor: ElectricDebtor;

  @RelationId((payment: ElectricDebtorPayment) => payment.debtor)
  debtor_id: number;

  @ManyToOne(() => Vendor, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'vendor_id' })
  vendor: Vendor;

  @RelationId((payment: ElectricDebtorPayment) => payment.vendor)
  vendor_id: number;

  @ManyToOne(() => Clientstore, { nullable: true })
  @JoinColumn({ name: 'clientstore_id' })
  clientstore: Clientstore;

  @RelationId((payment: ElectricDebtorPayment) => payment.clientstore)
  clientstore_id: number;

  @ManyToOne(() => ElectricCounter, { nullable: true })
  @JoinColumn({ name: 'counter_id' })
  counter: ElectricCounter;

  @RelationId((payment: ElectricDebtorPayment) => payment.counter)
  counter_id: number;

  @ManyToOne(() => ElectricCounterSession, { nullable: true })
  @JoinColumn({ name: 'session_id' })
  session: ElectricCounterSession;

  @RelationId((payment: ElectricDebtorPayment) => payment.session)
  session_id: number;

  @Column({ type: 'decimal', precision: 20, scale: 2, default: 0, transformer: DecimalTransformer })
  amount: number;

  @Column({ type: 'enum', enum: ElectricPaymentMethod, default: ElectricPaymentMethod.CASH })
  method: ElectricPaymentMethod;

  @Column({ type: 'text', nullable: true })
  note: string;

  @ManyToOne(() => Client, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'received_by' })
  received_by_client: Client;

  @RelationId((payment: ElectricDebtorPayment) => payment.received_by_client)
  received_by: number;

  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP(6)' })
  created_at: Date;
}
