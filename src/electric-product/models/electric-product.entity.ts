import { Column, CreateDateColumn, DeleteDateColumn, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, RelationId, UpdateDateColumn } from 'typeorm';
import { Vendor } from 'src/vendor/models/vendor.entity';
import { Clientstore } from 'src/clientstore/models/clientstore.entity';
import { ElectricBrand } from 'src/electric-brand/models/electric-brand.entity';
import { ElectricCategory } from 'src/electric-category/models/electric-category.entity';
import { ElectricProductVariant } from './electric-product-variant.entity';

@Entity('electric_products')
export class ElectricProduct {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Vendor)
  @JoinColumn({ name: 'vendor_id' })
  vendor: Vendor;

  @RelationId((product: ElectricProduct) => product.vendor)
  vendor_id: number;

  @ManyToOne(() => Clientstore)
  @JoinColumn({ name: 'clientstore_id' })
  clientstore: Clientstore;

  @RelationId((product: ElectricProduct) => product.clientstore)
  clientstore_id: number;

  @ManyToOne(() => ElectricCategory)
  @JoinColumn({ name: 'category_id' })
  category: ElectricCategory;

  @RelationId((product: ElectricProduct) => product.category)
  category_id: number;

  @ManyToOne(() => ElectricBrand, { nullable: true })
  @JoinColumn({ name: 'brand_id' })
  brand: ElectricBrand;

  @RelationId((product: ElectricProduct) => product.brand)
  brand_id: number;

  @Column({ type: 'int', nullable: true })
  number: number;

  @Column()
  name: string;

  @Column({ nullable: true })
  image_url: string;

  @Column({ default: true })
  is_active: boolean;

  @OneToMany(() => ElectricProductVariant, (variant) => variant.product)
  variants: ElectricProductVariant[];

  @CreateDateColumn({ type: "timestamp", default: () => "CURRENT_TIMESTAMP(6)" })
  created_at: Date;

  @UpdateDateColumn({ type: "timestamp", default: () => "CURRENT_TIMESTAMP(6)", onUpdate: "CURRENT_TIMESTAMP(6)" })
  updated_at: Date;

  @DeleteDateColumn()
  public deleted_at: Date;
}
