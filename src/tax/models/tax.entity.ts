import { Column, CreateDateColumn, DeleteDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, RelationId, UpdateDateColumn } from "typeorm";
import { Vendor } from "src/vendor/models/vendor.entity";
import { DecimalTransformer } from "src/common/decimal.transformer";

@Entity('taxes')
export class Tax {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Vendor)
  @JoinColumn({ name: 'vendor_id' })
  vendor: Vendor;

  @RelationId((tax: Tax) => tax.vendor)
  vendor_id: number;

  @Column()
  name: string;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0, transformer: DecimalTransformer })
  rate: number;

  @Column({ default: true })
  is_active: boolean;

  @CreateDateColumn({ type: "timestamp", default: () => "CURRENT_TIMESTAMP(6)" })
  created_at: Date;

  @UpdateDateColumn({ type: "timestamp", default: () => "CURRENT_TIMESTAMP(6)", onUpdate: "CURRENT_TIMESTAMP(6)" })
  updated_at: Date;

  @DeleteDateColumn()
  public deleted_at: Date;
}
