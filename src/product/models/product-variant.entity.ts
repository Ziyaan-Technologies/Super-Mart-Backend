import { Column, CreateDateColumn, DeleteDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, RelationId, Unique, UpdateDateColumn } from "typeorm";
import { Vendor } from "src/vendor/models/vendor.entity";
import { DecimalTransformer } from "src/common/decimal.transformer";
import { Product } from "./product.entity";

@Entity('product_variants')
@Unique('UQ_product_variants_vendor_sku', ['vendor', 'sku'])
@Unique('UQ_product_variants_vendor_barcode', ['vendor', 'barcode'])
export class ProductVariant {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Product, product => product.variants, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @RelationId((variant: ProductVariant) => variant.product)
  product_id: number;

  @ManyToOne(() => Vendor)
  @JoinColumn({ name: 'vendor_id' })
  vendor: Vendor;

  @RelationId((variant: ProductVariant) => variant.vendor)
  vendor_id: number;

  @Column()
  name: string;

  @Column()
  sku: string;

  @Column({ nullable: true })
  barcode: string;

  @Column({ type: 'decimal', precision: 18, scale: 3, default: 1, transformer: DecimalTransformer })
  unit_quantity: number;

  @Column({ type: 'decimal', precision: 20, scale: 4, default: 0, transformer: DecimalTransformer })
  cost_price: number;

  @Column({ type: 'decimal', precision: 20, scale: 2, default: 0, transformer: DecimalTransformer })
  sale_price: number;

  @Column({ type: 'decimal', precision: 20, scale: 2, nullable: true, transformer: DecimalTransformer })
  mrp: number;

  @Column({ type: 'decimal', precision: 18, scale: 3, default: 0, transformer: DecimalTransformer })
  reorder_level: number;

  @Column({ default: true })
  is_active: boolean;

  @CreateDateColumn({ type: "timestamp", default: () => "CURRENT_TIMESTAMP(6)" })
  created_at: Date;

  @UpdateDateColumn({ type: "timestamp", default: () => "CURRENT_TIMESTAMP(6)", onUpdate: "CURRENT_TIMESTAMP(6)" })
  updated_at: Date;

  @DeleteDateColumn()
  public deleted_at: Date;
}
