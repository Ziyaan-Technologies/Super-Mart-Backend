import { Column, CreateDateColumn, DeleteDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, RelationId, UpdateDateColumn } from "typeorm";
import { Vendor } from "src/vendor/models/vendor.entity";

@Entity('brands')
export class Brand {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Vendor)
  @JoinColumn({ name: 'vendor_id' })
  vendor: Vendor;

  @RelationId((brand: Brand) => brand.vendor)
  vendor_id: number;

  @Column()
  name: string;

  @Column({ nullable: true })
  image_url: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ default: true })
  is_active: boolean;

  @CreateDateColumn({ type: "timestamp", default: () => "CURRENT_TIMESTAMP(6)" })
  created_at: Date;

  @UpdateDateColumn({ type: "timestamp", default: () => "CURRENT_TIMESTAMP(6)", onUpdate: "CURRENT_TIMESTAMP(6)" })
  updated_at: Date;

  @DeleteDateColumn()
  public deleted_at: Date;
}
