import { Column, CreateDateColumn, DeleteDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, RelationId, UpdateDateColumn } from "typeorm";
import { Vendor } from "src/vendor/models/vendor.entity";
import { City } from "src/city/models/city.entity";
import { DecimalTransformer } from "src/common/decimal.transformer";

@Entity('suppliers')
export class Supplier {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Vendor)
  @JoinColumn({ name: 'vendor_id' })
  vendor: Vendor;

  @RelationId((supplier: Supplier) => supplier.vendor)
  vendor_id: number;

  @Column()
  name: string;

  @Column({ nullable: true })
  contact_person: string;

  @Column({ nullable: true })
  phone: string;

  @Column({ nullable: true })
  email: string;

  @Column({ nullable: true })
  address: string;

  @ManyToOne(() => City, { nullable: true })
  @JoinColumn({ name: 'city_id' })
  city: City;

  @RelationId((supplier: Supplier) => supplier.city)
  city_id: number;

  @Column({ nullable: true })
  tax_number: string;

  @Column({ default: 0 })
  payment_terms_days: number;

  @Column({ type: 'decimal', precision: 20, scale: 2, default: 0, transformer: DecimalTransformer })
  opening_balance: number;

  @Column({ type: 'text', nullable: true })
  note: string;

  @Column({ default: true })
  is_active: boolean;

  @CreateDateColumn({ type: "timestamp", default: () => "CURRENT_TIMESTAMP(6)" })
  created_at: Date;

  @UpdateDateColumn({ type: "timestamp", default: () => "CURRENT_TIMESTAMP(6)", onUpdate: "CURRENT_TIMESTAMP(6)" })
  updated_at: Date;

  @DeleteDateColumn()
  public deleted_at: Date;
}
