import { Column, CreateDateColumn, DeleteDateColumn, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, RelationId, UpdateDateColumn } from "typeorm";
import { Vendor } from "src/vendor/models/vendor.entity";
import { Clientstore } from "src/clientstore/models/clientstore.entity";
import { Client } from "src/client/models/client.entity";
import { DecimalTransformer } from "src/common/decimal.transformer";
import { StockAdjustmentItem } from "./stock-adjustment-item.entity";

export enum AdjustmentReason {
  COUNT_CORRECTION = 'Count Correction',
  DAMAGE = 'Damage',
  EXPIRY = 'Expiry',
  THEFT = 'Theft',
  INTERNAL_USE = 'Internal Use',
  OTHER = 'Other',
}

export enum StockAdjustmentStatus {
  DRAFT = 'Draft',
  POSTED = 'Posted',
}

@Entity('stock_adjustments')
export class StockAdjustment {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true, nullable: true })
  adjustment_number: string;

  @ManyToOne(() => Vendor)
  @JoinColumn({ name: 'vendor_id' })
  vendor: Vendor;

  @RelationId((adjustment: StockAdjustment) => adjustment.vendor)
  vendor_id: number;

  @ManyToOne(() => Clientstore)
  @JoinColumn({ name: 'clientstore_id' })
  clientstore: Clientstore;

  @RelationId((adjustment: StockAdjustment) => adjustment.clientstore)
  clientstore_id: number;

  @OneToMany(() => StockAdjustmentItem, item => item.stock_adjustment)
  items: StockAdjustmentItem[];

  @Column({ type: 'date' })
  adjustment_date: string;

  @Column({
    type: 'enum',
    enum: AdjustmentReason,
  })
  reason: AdjustmentReason;

  @Column({
    type: 'enum',
    enum: StockAdjustmentStatus,
    default: StockAdjustmentStatus.DRAFT
  })
  status: StockAdjustmentStatus;

  @Column({ type: 'decimal', precision: 20, scale: 2, default: 0, transformer: DecimalTransformer })
  total_value: number;

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
