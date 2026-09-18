import { Column, CreateDateColumn, DeleteDateColumn, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, RelationId, UpdateDateColumn } from "typeorm";
import { Vendor } from "src/vendor/models/vendor.entity";

@Entity('categories')
export class Category {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Vendor)
  @JoinColumn({ name: 'vendor_id' })
  vendor: Vendor;

  @RelationId((category: Category) => category.vendor)
  vendor_id: number;

  @ManyToOne(() => Category, category => category.children, { nullable: true })
  @JoinColumn({ name: 'parent_id' })
  parent: Category;

  @RelationId((category: Category) => category.parent)
  parent_id: number;

  @OneToMany(() => Category, category => category.parent)
  children: Category[];

  @Column()
  name: string;

  @Column({ default: 1 })
  level: number;

  @Column({ nullable: true })
  image_url: string;

  @Column({ type: 'text', nullable: true })
  description: string;

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
