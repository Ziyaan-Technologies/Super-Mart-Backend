import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, RelationId } from "typeorm";
import { ProductVariant } from "src/product/models/product-variant.entity";
import { PurchaseOrderItem } from "src/purchase-order/models/purchase-order-item.entity";
import { DecimalTransformer } from "src/common/decimal.transformer";
import { GoodsReceipt } from "./goods-receipt.entity";

@Entity('goods_receipt_items')
export class GoodsReceiptItem {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => GoodsReceipt, receipt => receipt.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'goods_receipt_id' })
  goods_receipt: GoodsReceipt;

  @RelationId((item: GoodsReceiptItem) => item.goods_receipt)
  goods_receipt_id: number;

  @ManyToOne(() => ProductVariant)
  @JoinColumn({ name: 'product_variant_id' })
  product_variant: ProductVariant;

  @RelationId((item: GoodsReceiptItem) => item.product_variant)
  product_variant_id: number;

  @ManyToOne(() => PurchaseOrderItem, { nullable: true })
  @JoinColumn({ name: 'purchase_order_item_id' })
  purchase_order_item: PurchaseOrderItem;

  @RelationId((item: GoodsReceiptItem) => item.purchase_order_item)
  purchase_order_item_id: number;

  @Column({ type: 'decimal', precision: 18, scale: 3, transformer: DecimalTransformer })
  quantity: number;

  @Column({ type: 'decimal', precision: 18, scale: 3, default: 0, transformer: DecimalTransformer })
  free_quantity: number;

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

  @Column({ nullable: true })
  batch_number: string;

  @Column({ type: 'date', nullable: true })
  expiry_date: string;
}
