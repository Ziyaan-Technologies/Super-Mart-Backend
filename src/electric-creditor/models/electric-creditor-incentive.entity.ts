import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, RelationId } from 'typeorm';
import { DecimalTransformer } from 'src/common/decimal.transformer';
import { Client } from 'src/client/models/client.entity';
import { Clientstore } from 'src/clientstore/models/clientstore.entity';
import { Vendor } from 'src/vendor/models/vendor.entity';
import { ElectricCreditor } from './electric-creditor.entity';

@Entity('electric_creditor_incentives')
export class ElectricCreditorIncentive {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => ElectricCreditor, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'creditor_id' })
  creditor: ElectricCreditor;

  @RelationId((incentive: ElectricCreditorIncentive) => incentive.creditor)
  creditor_id: number;

  @ManyToOne(() => Vendor, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'vendor_id' })
  vendor: Vendor;

  @RelationId((incentive: ElectricCreditorIncentive) => incentive.vendor)
  vendor_id: number;

  @ManyToOne(() => Clientstore, { nullable: true })
  @JoinColumn({ name: 'clientstore_id' })
  clientstore: Clientstore;

  @RelationId((incentive: ElectricCreditorIncentive) => incentive.clientstore)
  clientstore_id: number;

  @Column({ type: 'decimal', precision: 20, scale: 2, default: 0, transformer: DecimalTransformer })
  amount: number;

  @Column({ type: 'text', nullable: true })
  note: string;

  @ManyToOne(() => Client, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by' })
  created_by_client: Client;

  @RelationId((incentive: ElectricCreditorIncentive) => incentive.created_by_client)
  created_by: number;

  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP(6)' })
  created_at: Date;
}
