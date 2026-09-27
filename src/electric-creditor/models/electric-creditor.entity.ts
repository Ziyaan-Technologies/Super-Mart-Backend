import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, RelationId, UpdateDateColumn } from 'typeorm';
import { DecimalTransformer } from 'src/common/decimal.transformer';
import { Vendor } from 'src/vendor/models/vendor.entity';

@Entity('electric_creditors')
export class ElectricCreditor {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Vendor, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'vendor_id' })
  vendor: Vendor;

  @RelationId((creditor: ElectricCreditor) => creditor.vendor)
  vendor_id: number;

  @Column()
  name: string;

  @Column({ nullable: true })
  phone: string;

  @Column({ type: 'text', nullable: true })
  address: string;

  @Column({ nullable: true })
  image_url: string;

  @Column({ type: 'decimal', precision: 20, scale: 2, default: 0, transformer: DecimalTransformer })
  opening_balance: number;

  @Column({ type: 'text', nullable: true })
  note: string;

  @Column({ default: true })
  is_active: boolean;

  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP(6)' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP(6)', onUpdate: 'CURRENT_TIMESTAMP(6)' })
  updated_at: Date;
}
