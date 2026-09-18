import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, RelationId } from "typeorm";
import { ProductVariant } from "src/product/models/product-variant.entity";
import { DecimalTransformer } from "src/common/decimal.transformer";
import { PurchaseOrder } from "./purchase-order.entity";

@Entity('purchase_order_items')
export class PurchaseOrderItem {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => PurchaseOrder, order => order.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'purchase_order_id' })
  purchase_order: PurchaseOrder;

  @RelationId((item: PurchaseOrderItem) => item.purchase_order)
  purchase_order_id: number;

  @ManyToOne(() => ProductVariant)
  @JoinColumn({ name: 'product_variant_id' })
  product_variant: ProductVariant;

  @RelationId((item: PurchaseOrderItem) => item.product_variant)
  product_variant_id: number;

  @Column({ type: 'decimal', precision: 18, scale: 3, transformer: DecimalTransformer })
  quantity: number;

  @Column({ type: 'decimal', precision: 18, scale: 3, default: 0, transformer: DecimalTransformer })
  received_quantity: number;

  @Column({ type: 'decimal', precision: 20, scale: 4, transformer: DecimalTransformer })
  unit_cost: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0, transformer: DecimalTransformer })
  tax_rate: number;

  @Column({ type: 'decimal', precision: 20, scale: 2, default: 0, transformer: DecimalTransformer })
  discount_amount: number;

  @Column({ type: 'decimal', precision: 20, scale: 2, default: 0, transformer: DecimalTransformer })
  tax_amount: number;

  @Column({ type: 'decimal', precision: 20, scale: 2, default: 0, transformer: DecimalTransformer })
  line_total: number;
}
