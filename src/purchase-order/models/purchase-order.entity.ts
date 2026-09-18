import { Column, CreateDateColumn, DeleteDateColumn, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, RelationId, UpdateDateColumn } from "typeorm";
import { Vendor } from "src/vendor/models/vendor.entity";
import { Clientstore } from "src/clientstore/models/clientstore.entity";
import { Supplier } from "src/supplier/models/supplier.entity";
import { Client } from "src/client/models/client.entity";
import { DecimalTransformer } from "src/common/decimal.transformer";
import { PurchaseOrderItem } from "./purchase-order-item.entity";

export enum PurchaseOrderStatus {
  DRAFT = 'Draft',
  APPROVED = 'Approved',
  PARTIALLY_RECEIVED = 'Partially Received',
  RECEIVED = 'Received',
  CANCELLED = 'Cancelled',
}

@Entity('purchase_orders')
export class PurchaseOrder {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true, nullable: true })
  po_number: string;

  @ManyToOne(() => Vendor)
  @JoinColumn({ name: 'vendor_id' })
  vendor: Vendor;

  @RelationId((order: PurchaseOrder) => order.vendor)
  vendor_id: number;

  @ManyToOne(() => Clientstore)
  @JoinColumn({ name: 'clientstore_id' })
  clientstore: Clientstore;

  @RelationId((order: PurchaseOrder) => order.clientstore)
  clientstore_id: number;

  @ManyToOne(() => Supplier)
  @JoinColumn({ name: 'supplier_id' })
  supplier: Supplier;

  @RelationId((order: PurchaseOrder) => order.supplier)
  supplier_id: number;

  @OneToMany(() => PurchaseOrderItem, item => item.purchase_order)
  items: PurchaseOrderItem[];

  @Column({ type: 'date' })
  order_date: string;

  @Column({ type: 'date', nullable: true })
  expected_date: string;

  @Column({
    type: 'enum',
    enum: PurchaseOrderStatus,
    default: PurchaseOrderStatus.DRAFT
  })
  status: PurchaseOrderStatus;

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
  @JoinColumn({ name: 'approved_by_id' })
  approved_by: Client;

  @Column({ type: 'timestamp', nullable: true })
  approved_at: Date;

  @CreateDateColumn({ type: "timestamp", default: () => "CURRENT_TIMESTAMP(6)" })
  created_at: Date;

  @UpdateDateColumn({ type: "timestamp", default: () => "CURRENT_TIMESTAMP(6)", onUpdate: "CURRENT_TIMESTAMP(6)" })
  updated_at: Date;

  @DeleteDateColumn()
  public deleted_at: Date;
}
