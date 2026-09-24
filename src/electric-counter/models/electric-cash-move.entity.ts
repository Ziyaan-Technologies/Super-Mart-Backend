import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, RelationId } from 'typeorm';
import { Clientstore } from 'src/clientstore/models/clientstore.entity';
import { Client } from 'src/client/models/client.entity';
import { DecimalTransformer } from 'src/common/decimal.transformer';
import { ElectricCounter } from './electric-counter.entity';
import { ElectricCounterSession } from './electric-counter-session.entity';

export enum ElectricCashMoveType {
  IN = 'In',
  OUT = 'Out',
}

@Entity('electric_cash_moves')
export class ElectricCashMove {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => ElectricCounterSession)
  @JoinColumn({ name: 'session_id' })
  session: ElectricCounterSession;

  @RelationId((move: ElectricCashMove) => move.session)
  session_id: number;

  @ManyToOne(() => ElectricCounter)
  @JoinColumn({ name: 'counter_id' })
  counter: ElectricCounter;

  @RelationId((move: ElectricCashMove) => move.counter)
  counter_id: number;

  @ManyToOne(() => Clientstore)
  @JoinColumn({ name: 'clientstore_id' })
  clientstore: Clientstore;

  @RelationId((move: ElectricCashMove) => move.clientstore)
  clientstore_id: number;

  @Column({ type: 'enum', enum: ElectricCashMoveType })
  type: ElectricCashMoveType;

  @Column()
  reason: string;

  @Column({ type: 'decimal', precision: 20, scale: 2, default: 0, transformer: DecimalTransformer })
  amount: number;

  @Column({ nullable: true })
  note: string;

  @ManyToOne(() => Client)
  @JoinColumn({ name: 'created_by' })
  created_by_client: Client;

  @RelationId((move: ElectricCashMove) => move.created_by_client)
  created_by: number;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;
}
