import { Column, CreateDateColumn, DeleteDateColumn, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, RelationId, UpdateDateColumn } from "typeorm";
import { Vendor } from "src/vendor/models/vendor.entity";
import { Clientstore } from "src/clientstore/models/clientstore.entity";
import { Client } from "src/client/models/client.entity";
import { DecimalTransformer } from "src/common/decimal.transformer";
import { StockTransferItem } from "./stock-transfer-item.entity";

export enum StockTransferStatus {
  DRAFT = 'Draft',
  DISPATCHED = 'Dispatched',
  RECEIVED = 'Received',
  CANCELLED = 'Cancelled',
}

@Entity('stock_transfers')
export class StockTransfer {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true, nullable: true })
  transfer_number: string;

  @ManyToOne(() => Vendor)
  @JoinColumn({ name: 'vendor_id' })
  vendor: Vendor;

  @RelationId((transfer: StockTransfer) => transfer.vendor)
  vendor_id: number;

  @ManyToOne(() => Clientstore)
  @JoinColumn({ name: 'from_clientstore_id' })
  from_clientstore: Clientstore;

  @RelationId((transfer: StockTransfer) => transfer.from_clientstore)
  from_clientstore_id: number;

  @ManyToOne(() => Clientstore)
  @JoinColumn({ name: 'to_clientstore_id' })
  to_clientstore: Clientstore;

  @RelationId((transfer: StockTransfer) => transfer.to_clientstore)
  to_clientstore_id: number;

  @OneToMany(() => StockTransferItem, item => item.stock_transfer)
  items: StockTransferItem[];

  @Column({ type: 'date' })
  transfer_date: string;

  @Column({
    type: 'enum',
    enum: StockTransferStatus,
    default: StockTransferStatus.DRAFT
  })
  status: StockTransferStatus;

  @Column({ type: 'decimal', precision: 20, scale: 2, default: 0, transformer: DecimalTransformer })
  total_value: number;

  @Column({ type: 'text', nullable: true })
  note: string;

  @Column({ type: 'text', nullable: true })
  receive_note: string;

  @ManyToOne(() => Client, { nullable: true })
  @JoinColumn({ name: 'created_by_id' })
  created_by: Client;

  @ManyToOne(() => Client, { nullable: true })
  @JoinColumn({ name: 'dispatched_by_id' })
  dispatched_by: Client;

  @Column({ type: 'timestamp', nullable: true })
  dispatched_at: Date;

  @ManyToOne(() => Client, { nullable: true })
  @JoinColumn({ name: 'received_by_id' })
  received_by: Client;

  @Column({ type: 'timestamp', nullable: true })
  received_at: Date;

  @CreateDateColumn({ type: "timestamp", default: () => "CURRENT_TIMESTAMP(6)" })
  created_at: Date;

  @UpdateDateColumn({ type: "timestamp", default: () => "CURRENT_TIMESTAMP(6)", onUpdate: "CURRENT_TIMESTAMP(6)" })
  updated_at: Date;

  @DeleteDateColumn()
  public deleted_at: Date;
}
