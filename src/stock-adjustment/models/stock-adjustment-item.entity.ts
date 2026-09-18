import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, RelationId } from "typeorm";
import { ProductVariant } from "src/product/models/product-variant.entity";
import { StockBatch } from "src/stock/models/stock-batch.entity";
import { DecimalTransformer } from "src/common/decimal.transformer";
import { StockAdjustment } from "./stock-adjustment.entity";

@Entity('stock_adjustment_items')
export class StockAdjustmentItem {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => StockAdjustment, adjustment => adjustment.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'stock_adjustment_id' })
  stock_adjustment: StockAdjustment;

  @RelationId((item: StockAdjustmentItem) => item.stock_adjustment)
  stock_adjustment_id: number;

  @ManyToOne(() => ProductVariant)
  @JoinColumn({ name: 'product_variant_id' })
  product_variant: ProductVariant;

  @RelationId((item: StockAdjustmentItem) => item.product_variant)
  product_variant_id: number;

  @ManyToOne(() => StockBatch, { nullable: true })
  @JoinColumn({ name: 'stock_batch_id' })
  stock_batch: StockBatch;

  @RelationId((item: StockAdjustmentItem) => item.stock_batch)
  stock_batch_id: number;

  @Column({ type: 'decimal', precision: 18, scale: 3, default: 0, transformer: DecimalTransformer })
  quantity: number;

  @Column({ type: 'decimal', precision: 18, scale: 3, nullable: true, transformer: DecimalTransformer })
  counted_quantity: number;

  @Column({ type: 'decimal', precision: 18, scale: 3, nullable: true, transformer: DecimalTransformer })
  system_quantity: number;

  @Column({ type: 'decimal', precision: 20, scale: 4, nullable: true, transformer: DecimalTransformer })
  unit_cost: number;

  @Column({ type: 'decimal', precision: 20, scale: 2, default: 0, transformer: DecimalTransformer })
  line_value: number;

  @Column({ type: 'date', nullable: true })
  expiry_date: string;

  @Column({ nullable: true })
  batch_number: string;
}
