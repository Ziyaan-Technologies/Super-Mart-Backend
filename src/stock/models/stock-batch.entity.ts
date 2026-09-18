import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, RelationId } from "typeorm";
import { Vendor } from "src/vendor/models/vendor.entity";
import { Clientstore } from "src/clientstore/models/clientstore.entity";
import { ProductVariant } from "src/product/models/product-variant.entity";
import { DecimalTransformer } from "src/common/decimal.transformer";

@Entity('stock_batches')
@Index('IDX_stock_batches_store_variant_expiry', ['clientstore', 'product_variant', 'expiry_date'])
export class StockBatch {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Vendor)
  @JoinColumn({ name: 'vendor_id' })
  vendor: Vendor;

  @RelationId((batch: StockBatch) => batch.vendor)
  vendor_id: number;

  @ManyToOne(() => Clientstore)
  @JoinColumn({ name: 'clientstore_id' })
  clientstore: Clientstore;

  @RelationId((batch: StockBatch) => batch.clientstore)
  clientstore_id: number;

  @ManyToOne(() => ProductVariant)
  @JoinColumn({ name: 'product_variant_id' })
  product_variant: ProductVariant;

  @RelationId((batch: StockBatch) => batch.product_variant)
  product_variant_id: number;

  @Column({ nullable: true })
  batch_number: string;

  @Column({ type: 'date', nullable: true })
  expiry_date: string;

  @Column({ type: 'decimal', precision: 18, scale: 3, default: 0, transformer: DecimalTransformer })
  received_quantity: number;

  @Column({ type: 'decimal', precision: 18, scale: 3, default: 0, transformer: DecimalTransformer })
  quantity: number;

  @Column({ type: 'decimal', precision: 20, scale: 4, default: 0, transformer: DecimalTransformer })
  unit_cost: number;

  @CreateDateColumn({ type: "timestamp", default: () => "CURRENT_TIMESTAMP(6)" })
  created_at: Date;
}
