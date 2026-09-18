import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, RelationId, UpdateDateColumn } from "typeorm";
import { Vendor } from "src/vendor/models/vendor.entity";
import { Clientstore } from "src/clientstore/models/clientstore.entity";
import { Client } from "src/client/models/client.entity";
import { DecimalTransformer } from "src/common/decimal.transformer";

export enum RegisterSessionStatus {
  OPEN = 'Open',
  CLOSED = 'Closed',
}

@Entity('register_sessions')
@Index('IDX_register_sessions_cashier_status', ['cashier', 'status'])
export class RegisterSession {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true, nullable: true })
  session_number: string;

  @ManyToOne(() => Vendor)
  @JoinColumn({ name: 'vendor_id' })
  vendor: Vendor;

  @RelationId((session: RegisterSession) => session.vendor)
  vendor_id: number;

  @ManyToOne(() => Clientstore)
  @JoinColumn({ name: 'clientstore_id' })
  clientstore: Clientstore;

  @RelationId((session: RegisterSession) => session.clientstore)
  clientstore_id: number;

  @ManyToOne(() => Client)
  @JoinColumn({ name: 'cashier_id' })
  cashier: Client;

  @RelationId((session: RegisterSession) => session.cashier)
  cashier_id: number;

  @Column({
    type: 'enum',
    enum: RegisterSessionStatus,
    default: RegisterSessionStatus.OPEN
  })
  status: RegisterSessionStatus;

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
