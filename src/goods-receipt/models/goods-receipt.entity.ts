import { Column, CreateDateColumn, DeleteDateColumn, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, RelationId, UpdateDateColumn } from "typeorm";
import { Vendor } from "src/vendor/models/vendor.entity";
import { Clientstore } from "src/clientstore/models/clientstore.entity";
import { Supplier } from "src/supplier/models/supplier.entity";
import { Client } from "src/client/models/client.entity";
import { PurchaseOrder } from "src/purchase-order/models/purchase-order.entity";
import { DecimalTransformer } from "src/common/decimal.transformer";
import { GoodsReceiptItem } from "./goods-receipt-item.entity";

export enum GoodsReceiptStatus {
  DRAFT = 'Draft',
  POSTED = 'Posted',
}

@Entity('goods_receipts')
export class GoodsReceipt {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true, nullable: true })
  grn_number: string;

  @ManyToOne(() => Vendor)
  @JoinColumn({ name: 'vendor_id' })
  vendor: Vendor;

  @RelationId((receipt: GoodsReceipt) => receipt.vendor)
  vendor_id: number;

  @ManyToOne(() => Clientstore)
  @JoinColumn({ name: 'clientstore_id' })
  clientstore: Clientstore;

  @RelationId((receipt: GoodsReceipt) => receipt.clientstore)
  clientstore_id: number;

  @ManyToOne(() => Supplier)
  @JoinColumn({ name: 'supplier_id' })
  supplier: Supplier;

  @RelationId((receipt: GoodsReceipt) => receipt.supplier)
  supplier_id: number;

  @ManyToOne(() => PurchaseOrder, { nullable: true })
  @JoinColumn({ name: 'purchase_order_id' })
  purchase_order: PurchaseOrder;

  @RelationId((receipt: GoodsReceipt) => receipt.purchase_order)
  purchase_order_id: number;

  @OneToMany(() => GoodsReceiptItem, item => item.goods_receipt)
  items: GoodsReceiptItem[];

  @Column({ type: 'date' })
  received_date: string;

  @Column({ nullable: true })
  supplier_invoice_number: string;

  @Column({
    type: 'enum',
    enum: GoodsReceiptStatus,
    default: GoodsReceiptStatus.DRAFT
  })
  status: GoodsReceiptStatus;

  @Column({ type: 'decimal', precision: 20, scale: 2, default: 0, transformer: DecimalTransformer })
  subtotal: number;

  @Column({ type: 'decimal', precision: 20, scale: 2, default: 0, transformer: DecimalTransformer })
  discount_amount: number;

  @Column({ type: 'decimal', precision: 20, scale: 2, default: 0, transformer: DecimalTransformer })
  tax_amount: number;

  @Column({ type: 'decimal', precision: 20, scale: 2, default: 0, transformer: DecimalTransformer })
  total_amount: number;

  @Column({ type: 'text', nullable: true })
  note: string;

  @ManyToOne(() => Client, { nullable: true })
  @JoinColumn({ name: 'created_by_id' })
  created_by: Client;

  @ManyToOne(() => Client, { nullable: true })
  @JoinColumn({ name: 'posted_by_id' })
  posted_by: Client;

  @Column({ type: 'timestamp', nullable: true })
  posted_at: Date;

  @CreateDateColumn({ type: "timestamp", default: () => "CURRENT_TIMESTAMP(6)" })
  created_at: Date;

  @UpdateDateColumn({ type: "timestamp", default: () => "CURRENT_TIMESTAMP(6)", onUpdate: "CURRENT_TIMESTAMP(6)" })
  updated_at: Date;

  @DeleteDateColumn()
  public deleted_at: Date;
}
