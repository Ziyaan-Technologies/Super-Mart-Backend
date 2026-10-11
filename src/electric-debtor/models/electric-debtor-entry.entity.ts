import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, RelationId } from 'typeorm';
import { DecimalTransformer } from 'src/common/decimal.transformer';
import { Client } from 'src/client/models/client.entity';
import { Clientstore } from 'src/clientstore/models/clientstore.entity';
import { Vendor } from 'src/vendor/models/vendor.entity';
import { ElectricCounter } from 'src/electric-counter/models/electric-counter.entity';
import { ElectricCounterSession } from 'src/electric-counter/models/electric-counter-session.entity';
import { ElectricCashMove } from 'src/electric-counter/models/electric-cash-move.entity';
import { ElectricDebtor } from './electric-debtor.entity';

/** money handed to a debtor, which adds to what he owes */
@Entity('electric_debtor_entries')
export class ElectricDebtorEntry {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => ElectricDebtor, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'debtor_id' })
  debtor: ElectricDebtor;

  @RelationId((entry: ElectricDebtorEntry) => entry.debtor)
  debtor_id: number;

  @ManyToOne(() => Vendor, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'vendor_id' })
  vendor: Vendor;

  @RelationId((entry: ElectricDebtorEntry) => entry.vendor)
  vendor_id: number;

  @ManyToOne(() => Clientstore, { nullable: true })
  @JoinColumn({ name: 'clientstore_id' })
  clientstore: Clientstore;

  @RelationId((entry: ElectricDebtorEntry) => entry.clientstore)
  clientstore_id: number;

  @ManyToOne(() => ElectricCounter, { nullable: true })
  @JoinColumn({ name: 'counter_id' })
  counter: ElectricCounter;

  @RelationId((entry: ElectricDebtorEntry) => entry.counter)
  counter_id: number;

  @ManyToOne(() => ElectricCounterSession, { nullable: true })
  @JoinColumn({ name: 'session_id' })
  session: ElectricCounterSession;

  @RelationId((entry: ElectricDebtorEntry) => entry.session)
  session_id: number;

  @ManyToOne(() => ElectricCashMove, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'cash_move_id' })
  cash_move: ElectricCashMove;

  @RelationId((entry: ElectricDebtorEntry) => entry.cash_move)
  cash_move_id: number;

  @Column({ type: 'decimal', precision: 20, scale: 2, default: 0, transformer: DecimalTransformer })
  amount: number;

  @Column({ type: 'text', nullable: true })
  note: string;

  @ManyToOne(() => Client, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'given_by' })
  given_by_client: Client;

  @RelationId((entry: ElectricDebtorEntry) => entry.given_by_client)
  given_by: number;

  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP(6)' })
  created_at: Date;
}
