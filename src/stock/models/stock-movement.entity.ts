import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, RelationId } from "typeorm";
import { Vendor } from "src/vendor/models/vendor.entity";
import { Clientstore } from "src/clientstore/models/clientstore.entity";
import { ProductVariant } from "src/product/models/product-variant.entity";
import { Client } from "src/client/models/client.entity";
import { DecimalTransformer } from "src/common/decimal.transformer";
import { StockBatch } from "./stock-batch.entity";

export enum StockMovementType {
  OPENING = 'Opening',
  PURCHASE = 'Purchase',
  PURCHASE_RETURN = 'Purchase Return',
  SALE = 'Sale',
  SALE_RETURN = 'Sale Return',
  TRANSFER_IN = 'Transfer In',
  TRANSFER_OUT = 'Transfer Out',
  ADJUSTMENT_IN = 'Adjustment In',
  ADJUSTMENT_OUT = 'Adjustment Out',
  WASTAGE = 'Wastage',
}

export const INBOUND_MOVEMENTS = [
  StockMovementType.OPENING,
  StockMovementType.PURCHASE,
  StockMovementType.SALE_RETURN,
  StockMovementType.TRANSFER_IN,
  StockMovementType.ADJUSTMENT_IN,
];

@Entity('stock_movements')
@Index('IDX_stock_movements_store_variant_date', ['clientstore', 'product_variant', 'created_at'])
@Index('IDX_stock_movements_reference', ['reference_type', 'reference_id'])
export class StockMovement {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Vendor)
  @JoinColumn({ name: 'vendor_id' })
  vendor: Vendor;

  @RelationId((movement: StockMovement) => movement.vendor)
  vendor_id: number;

  @ManyToOne(() => Clientstore)
  @JoinColumn({ name: 'clientstore_id' })
  clientstore: Clientstore;

  @RelationId((movement: StockMovement) => movement.clientstore)
  clientstore_id: number;

  @ManyToOne(() => ProductVariant)
  @JoinColumn({ name: 'product_variant_id' })
  product_variant: ProductVariant;

  @RelationId((movement: StockMovement) => movement.product_variant)
  product_variant_id: number;

  @ManyToOne(() => StockBatch, { nullable: true })
  @JoinColumn({ name: 'stock_batch_id' })
  stock_batch: StockBatch;

  @Column({
    type: 'enum',
    enum: StockMovementType,
  })
  type: StockMovementType;

  @Column({ type: 'decimal', precision: 18, scale: 3, transformer: DecimalTransformer })
  quantity: number;

  @Column({ type: 'decimal', precision: 20, scale: 4, default: 0, transformer: DecimalTransformer })
  unit_cost: number;

  @Column({ type: 'decimal', precision: 18, scale: 3, transformer: DecimalTransformer })
  balance_after: number;

  @Column({ nullable: true })
  reference_type: string;

  @Column({ nullable: true })
  reference_id: number;

  @Column({ nullable: true })
  reference_number: string;

  @Column({ type: 'text', nullable: true })
  note: string;

  @ManyToOne(() => Client, { nullable: true })
  @JoinColumn({ name: 'created_by_id' })
  created_by: Client;

  @CreateDateColumn({ type: "timestamp", default: () => "CURRENT_TIMESTAMP(6)" })
  created_at: Date;
}
