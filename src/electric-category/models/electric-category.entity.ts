import { Column, CreateDateColumn, DeleteDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, RelationId, UpdateDateColumn } from 'typeorm';
import { Vendor } from 'src/vendor/models/vendor.entity';
import { Clientstore } from 'src/clientstore/models/clientstore.entity';

@Entity('electric_categories')
export class ElectricCategory {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Vendor)
  @JoinColumn({ name: 'vendor_id' })
  vendor: Vendor;

  @RelationId((category: ElectricCategory) => category.vendor)
  vendor_id: number;

  @ManyToOne(() => Clientstore)
  @JoinColumn({ name: 'clientstore_id' })
  clientstore: Clientstore;

  @RelationId((category: ElectricCategory) => category.clientstore)
  clientstore_id: number;

  @Column()
  name: string;

  @Column({ nullable: true })
  image_url: string;

  @Column({ default: 0 })
  sort_order: number;

  @Column({ default: true })
  is_active: boolean;

  @CreateDateColumn({ type: "timestamp", default: () => "CURRENT_TIMESTAMP(6)" })
  created_at: Date;

  @UpdateDateColumn({ type: "timestamp", default: () => "CURRENT_TIMESTAMP(6)", onUpdate: "CURRENT_TIMESTAMP(6)" })
  updated_at: Date;

  @DeleteDateColumn()
  public deleted_at: Date;
}
