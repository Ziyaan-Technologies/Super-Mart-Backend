import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, RelationId } from "typeorm";
import { ProductVariant } from "src/product/models/product-variant.entity";
import { DecimalTransformer } from "src/common/decimal.transformer";
import { Sale } from "./sale.entity";

@Entity('sale_items')
export class SaleItem {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Sale, sale => sale.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sale_id' })
  sale: Sale;

  @RelationId((item: SaleItem) => item.sale)
  sale_id: number;

  @ManyToOne(() => ProductVariant)
  @JoinColumn({ name: 'product_variant_id' })
  product_variant: ProductVariant;

  @RelationId((item: SaleItem) => item.product_variant)
  product_variant_id: number;

  @Column()
  product_name: string;

  @Column()
  variant_name: string;

  @Column()
  sku: string;

  @Column({ nullable: true })
  unit_label: string;

  @Column({ type: 'decimal', precision: 18, scale: 3, transformer: DecimalTransformer })
  quantity: number;

  @Column({ type: 'decimal', precision: 20, scale: 2, transformer: DecimalTransformer })
  unit_price: number;

  @Column({ type: 'decimal', precision: 20, scale: 2, default: 0, transformer: DecimalTransformer })
  discount_amount: number;

  @Column({ type: 'decimal', precision: 20, scale: 2, default: 0, transformer: DecimalTransformer })
  bill_discount_share: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0, transformer: DecimalTransformer })
  tax_rate: number;

  @Column({ default: true })
  price_includes_tax: boolean;

  @Column({ type: 'decimal', precision: 20, scale: 2, default: 0, transformer: DecimalTransformer })
  tax_amount: number;

  @Column({ type: 'decimal', precision: 20, scale: 2, default: 0, transformer: DecimalTransformer })
  line_total: number;

  @Column({ type: 'decimal', precision: 20, scale: 4, default: 0, transformer: DecimalTransformer })
  unit_cost: number;

  @Column({ type: 'decimal', precision: 18, scale: 3, default: 0, transformer: DecimalTransformer })
  returned_quantity: number;
}
