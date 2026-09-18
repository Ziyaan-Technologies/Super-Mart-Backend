import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, RelationId, Unique, UpdateDateColumn } from "typeorm";
import { Vendor } from "src/vendor/models/vendor.entity";
import { Clientstore } from "src/clientstore/models/clientstore.entity";
import { ProductVariant } from "src/product/models/product-variant.entity";
import { DecimalTransformer } from "src/common/decimal.transformer";

@Entity('stocks')
@Unique('UQ_stocks_store_variant', ['clientstore', 'product_variant'])
@Index('IDX_stocks_vendor', ['vendor'])
export class Stock {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Vendor)
  @JoinColumn({ name: 'vendor_id' })
  vendor: Vendor;

  @RelationId((stock: Stock) => stock.vendor)
  vendor_id: number;

  @ManyToOne(() => Clientstore)
  @JoinColumn({ name: 'clientstore_id' })
  clientstore: Clientstore;

  @RelationId((stock: Stock) => stock.clientstore)
  clientstore_id: number;

  @ManyToOne(() => ProductVariant)
  @JoinColumn({ name: 'product_variant_id' })
  product_variant: ProductVariant;

  @RelationId((stock: Stock) => stock.product_variant)
  product_variant_id: number;

  @Column({ type: 'decimal', precision: 18, scale: 3, default: 0, transformer: DecimalTransformer })
  quantity: number;

  @Column({ type: 'decimal', precision: 20, scale: 4, default: 0, transformer: DecimalTransformer })
  average_cost: number;

  @UpdateDateColumn({ type: "timestamp", default: () => "CURRENT_TIMESTAMP(6)", onUpdate: "CURRENT_TIMESTAMP(6)" })
  updated_at: Date;
}
