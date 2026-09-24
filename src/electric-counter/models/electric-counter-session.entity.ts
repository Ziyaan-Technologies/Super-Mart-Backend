import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, RelationId, UpdateDateColumn } from 'typeorm';
import { Vendor } from 'src/vendor/models/vendor.entity';
import { Clientstore } from 'src/clientstore/models/clientstore.entity';
import { Client } from 'src/client/models/client.entity';
import { DecimalTransformer } from 'src/common/decimal.transformer';
import { ElectricCounter } from './electric-counter.entity';

export enum ElectricSessionStatus {
  OPEN = 'Open',
  CLOSED = 'Closed',
}

@Entity('electric_counter_sessions')
@Index('IDX_electric_counter_sessions_cashier_status', ['cashier', 'status'])
export class ElectricCounterSession {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true, nullable: true })
  session_number: string;

  @ManyToOne(() => Vendor)
  @JoinColumn({ name: 'vendor_id' })
  vendor: Vendor;

  @RelationId((session: ElectricCounterSession) => session.vendor)
  vendor_id: number;

  @ManyToOne(() => Clientstore)
  @JoinColumn({ name: 'clientstore_id' })
  clientstore: Clientstore;

  @RelationId((session: ElectricCounterSession) => session.clientstore)
  clientstore_id: number;

  @ManyToOne(() => ElectricCounter)
  @JoinColumn({ name: 'counter_id' })
  counter: ElectricCounter;

  @RelationId((session: ElectricCounterSession) => session.counter)
  counter_id: number;

  @ManyToOne(() => Client)
  @JoinColumn({ name: 'cashier_id' })
  cashier: Client;

  @RelationId((session: ElectricCounterSession) => session.cashier)
  cashier_id: number;

  @Column({ type: 'enum', enum: ElectricSessionStatus, default: ElectricSessionStatus.OPEN })
  status: ElectricSessionStatus;

  @Column({ type: 'decimal', precision: 20, scale: 2, default: 0, transformer: DecimalTransformer })
  opening_cash: number;

  @Column({ type: 'decimal', precision: 20, scale: 2, nullable: true, transformer: DecimalTransformer })
  expected_cash: number;

  @Column({ type: 'decimal', precision: 20, scale: 2, nullable: true, transformer: DecimalTransformer })
  closing_cash: number;

  @Column({ type: 'decimal', precision: 20, scale: 2, nullable: true, transformer: DecimalTransformer })
  cash_difference: number;

  @Column({ type: 'text', nullable: true })
  note: string;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  opened_at: Date;

  @Column({ type: 'timestamp', nullable: true })
  closed_at: Date;

  @CreateDateColumn({ type: "timestamp", default: () => "CURRENT_TIMESTAMP(6)" })
  created_at: Date;

  @UpdateDateColumn({ type: "timestamp", default: () => "CURRENT_TIMESTAMP(6)", onUpdate: "CURRENT_TIMESTAMP(6)" })
  updated_at: Date;
}
