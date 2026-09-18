import { Column, CreateDateColumn, DeleteDateColumn, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, RelationId, UpdateDateColumn } from "typeorm";
import { Vendor } from "src/vendor/models/vendor.entity";
import { Category } from "src/category/models/category.entity";
import { Brand } from "src/brand/models/brand.entity";
import { Unit } from "src/unit/models/unit.entity";
import { Tax } from "src/tax/models/tax.entity";
import { ProductVariant } from "./product-variant.entity";

@Entity('products')
export class Product {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Vendor)
  @JoinColumn({ name: 'vendor_id' })
  vendor: Vendor;

  @RelationId((product: Product) => product.vendor)
  vendor_id: number;

  @ManyToOne(() => Category)
  @JoinColumn({ name: 'category_id' })
  category: Category;

  @RelationId((product: Product) => product.category)
  category_id: number;

  @ManyToOne(() => Brand, { nullable: true })
  @JoinColumn({ name: 'brand_id' })
  brand: Brand;

  @RelationId((product: Product) => product.brand)
  brand_id: number;

  @ManyToOne(() => Unit)
  @JoinColumn({ name: 'unit_id' })
  unit: Unit;

  @RelationId((product: Product) => product.unit)
  unit_id: number;

  @ManyToOne(() => Tax, { nullable: true })
  @JoinColumn({ name: 'tax_id' })
  tax: Tax;

  @RelationId((product: Product) => product.tax)
  tax_id: number;

  @OneToMany(() => ProductVariant, variant => variant.product)
  variants: ProductVariant[];

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ nullable: true })
  image_url: string;

  @Column({ default: true })
  price_includes_tax: boolean;

  @Column({ default: false })
  is_weighted: boolean;

  @Column({ default: false })
  track_expiry: boolean;

  @Column({ default: true })
  is_active: boolean;

  @CreateDateColumn({ type: "timestamp", default: () => "CURRENT_TIMESTAMP(6)" })
  created_at: Date;

  @UpdateDateColumn({ type: "timestamp", default: () => "CURRENT_TIMESTAMP(6)", onUpdate: "CURRENT_TIMESTAMP(6)" })
  updated_at: Date;

  @DeleteDateColumn()
  public deleted_at: Date;
}
