import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, RelationId, UpdateDateColumn } from 'typeorm';
import { Vendor } from 'src/vendor/models/vendor.entity';
import { Clientstore } from 'src/clientstore/models/clientstore.entity';
import { Client } from 'src/client/models/client.entity';
import { ElectricCounter } from 'src/electric-counter/models/electric-counter.entity';
import { ElectricDocumentTotals } from 'src/common/electric-document.entity';
import { ElectricQuotationItem } from './electric-quotation-item.entity';

export enum ElectricQuotationStatus {
  OPEN = 'Open',
  CONVERTED = 'Converted',
}

@Entity('electric_quotations')
export class ElectricQuotation extends ElectricDocumentTotals {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  quotation_number: string;

  @ManyToOne(() => Vendor)
  @JoinColumn({ name: 'vendor_id' })
  vendor: Vendor;

  @RelationId((quotation: ElectricQuotation) => quotation.vendor)
  vendor_id: number;

  @ManyToOne(() => Clientstore)
  @JoinColumn({ name: 'clientstore_id' })
  clientstore: Clientstore;

  @RelationId((quotation: ElectricQuotation) => quotation.clientstore)
  clientstore_id: number;

  @ManyToOne(() => ElectricCounter, { nullable: true })
  @JoinColumn({ name: 'counter_id' })
  counter: ElectricCounter;

  @RelationId((quotation: ElectricQuotation) => quotation.counter)
  counter_id: number;

  @ManyToOne(() => Client)
  @JoinColumn({ name: 'created_by' })
  created_by_client: Client;

  @RelationId((quotation: ElectricQuotation) => quotation.created_by_client)
  created_by: number;

  @Column({ type: 'date' })
  valid_until: string;

  @Column({ default: true })
  show_item_prices: boolean;

  @Column({ type: 'enum', enum: ElectricQuotationStatus, default: ElectricQuotationStatus.OPEN })
  status: ElectricQuotationStatus;

  @Column({ nullable: true })
  sale_id: number;

  @OneToMany(() => ElectricQuotationItem, (item) => item.quotation)
  items: ElectricQuotationItem[];

  @CreateDateColumn({ type: "timestamp", default: () => "CURRENT_TIMESTAMP(6)" })
  created_at: Date;

  @UpdateDateColumn({ type: "timestamp", default: () => "CURRENT_TIMESTAMP(6)", onUpdate: "CURRENT_TIMESTAMP(6)" })
  updated_at: Date;
}
