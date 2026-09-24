import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, RelationId } from 'typeorm';
import { DecimalTransformer } from 'src/common/decimal.transformer';
import { Client } from 'src/client/models/client.entity';
import { Clientstore } from 'src/clientstore/models/clientstore.entity';
import { Vendor } from 'src/vendor/models/vendor.entity';
import { ElectricProduct } from './electric-product.entity';
import { ElectricProductVariant } from './electric-product-variant.entity';

export enum ElectricStockEntryType {
  IN = 'In',
  CORRECTION = 'Correction',
}

@Entity('electric_stock_entries')
export class ElectricStockEntry {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Vendor, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'vendor_id' })
  vendor: Vendor;

  @RelationId((entry: ElectricStockEntry) => entry.vendor)
  vendor_id: number;

  @ManyToOne(() => Clientstore, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'clientstore_id' })
  clientstore: Clientstore;

  @RelationId((entry: ElectricStockEntry) => entry.clientstore)
  clientstore_id: number;

  @ManyToOne(() => ElectricProduct, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'product_id' })
  product: ElectricProduct;

  @RelationId((entry: ElectricStockEntry) => entry.product)
  product_id: number;

  @ManyToOne(() => ElectricProductVariant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'variant_id' })
  variant: ElectricProductVariant;

  @RelationId((entry: ElectricStockEntry) => entry.variant)
  variant_id: number;

  @Column({ type: 'enum', enum: ElectricStockEntryType, default: ElectricStockEntryType.IN })
  type: ElectricStockEntryType;

  @Column({ type: 'decimal', precision: 20, scale: 3, default: 0, transformer: DecimalTransformer })
  quantity: number;

  @Column({ type: 'decimal', precision: 20, scale: 2, default: 0, transformer: DecimalTransformer })
  cost_price: number;

  @Column({ type: 'decimal', precision: 20, scale: 2, default: 0, transformer: DecimalTransformer })
  total_cost: number;

  @Column({ type: 'decimal', precision: 20, scale: 3, default: 0, transformer: DecimalTransformer })
  stock_after: number;

  @Column({ type: 'decimal', precision: 20, scale: 2, default: 0, transformer: DecimalTransformer })
  cost_after: number;

  @Column({ nullable: true })
  supplier: string;

  @Column({ type: 'text', nullable: true })
  note: string;

  @ManyToOne(() => Client, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by' })
  created_by_client: Client;

  @RelationId((entry: ElectricStockEntry) => entry.created_by_client)
  created_by: number;

  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP(6)' })
  created_at: Date;
}
