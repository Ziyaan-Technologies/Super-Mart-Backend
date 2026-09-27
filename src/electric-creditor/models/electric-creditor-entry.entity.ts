import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, RelationId } from 'typeorm';
import { DecimalTransformer } from 'src/common/decimal.transformer';
import { Client } from 'src/client/models/client.entity';
import { Clientstore } from 'src/clientstore/models/clientstore.entity';
import { Vendor } from 'src/vendor/models/vendor.entity';
import { ElectricSaleItem } from 'src/electric-sale/models/electric-sale-item.entity';
import { ElectricCreditor } from './electric-creditor.entity';

export enum ElectricCreditorEntryType {
  ITEM = 'Item',
  MANUAL = 'Manual',
}

@Entity('electric_creditor_entries')
export class ElectricCreditorEntry {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => ElectricCreditor, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'creditor_id' })
  creditor: ElectricCreditor;

  @RelationId((entry: ElectricCreditorEntry) => entry.creditor)
  creditor_id: number;

  @ManyToOne(() => Vendor, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'vendor_id' })
  vendor: Vendor;

  @RelationId((entry: ElectricCreditorEntry) => entry.vendor)
  vendor_id: number;

  @ManyToOne(() => Clientstore, { nullable: true })
  @JoinColumn({ name: 'clientstore_id' })
  clientstore: Clientstore;

  @RelationId((entry: ElectricCreditorEntry) => entry.clientstore)
  clientstore_id: number;

  @ManyToOne(() => ElectricSaleItem, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sale_item_id' })
  sale_item: ElectricSaleItem;

  @RelationId((entry: ElectricCreditorEntry) => entry.sale_item)
  sale_item_id: number;

  @Column({ type: 'enum', enum: ElectricCreditorEntryType, default: ElectricCreditorEntryType.MANUAL })
  type: ElectricCreditorEntryType;

  @Column({ type: 'decimal', precision: 20, scale: 2, default: 0, transformer: DecimalTransformer })
  amount: number;

  @Column({ type: 'text', nullable: true })
  note: string;

  @ManyToOne(() => Client, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by' })
  created_by_client: Client;

  @RelationId((entry: ElectricCreditorEntry) => entry.created_by_client)
  created_by: number;

  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP(6)' })
  created_at: Date;
}
