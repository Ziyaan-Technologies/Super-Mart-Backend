import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, RelationId } from "typeorm";
import { ProductVariant } from "src/product/models/product-variant.entity";
import { DecimalTransformer } from "src/common/decimal.transformer";
import { StockTransfer } from "./stock-transfer.entity";

@Entity('stock_transfer_items')
export class StockTransferItem {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => StockTransfer, transfer => transfer.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'stock_transfer_id' })
  stock_transfer: StockTransfer;

  @RelationId((item: StockTransferItem) => item.stock_transfer)
  stock_transfer_id: number;

  @ManyToOne(() => ProductVariant)
  @JoinColumn({ name: 'product_variant_id' })
  product_variant: ProductVariant;

  @RelationId((item: StockTransferItem) => item.product_variant)
  product_variant_id: number;

  @Column({ type: 'decimal', precision: 18, scale: 3, transformer: DecimalTransformer })
  quantity: number;

  @Column({ type: 'decimal', precision: 18, scale: 3, nullable: true, transformer: DecimalTransformer })
  received_quantity: number;

  @Column({ type: 'decimal', precision: 20, scale: 4, default: 0, transformer: DecimalTransformer })
  unit_cost: number;

  @Column({ type: 'json', nullable: true })
  batch_allocations: any;
}
