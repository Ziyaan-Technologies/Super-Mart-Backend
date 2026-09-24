import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, RelationId, UpdateDateColumn } from 'typeorm';
import { DecimalTransformer } from 'src/common/decimal.transformer';
import { ElectricProduct } from './electric-product.entity';

@Entity('electric_product_variants')
@Index('IDX_electric_product_variants_sku', ['sku'])
export class ElectricProductVariant {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => ElectricProduct, (product) => product.variants, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'product_id' })
  product: ElectricProduct;

  @RelationId((variant: ElectricProductVariant) => variant.product)
  product_id: number;

  @Column()
  name: string;

  @Column()
  sku: string;

  @Column({ nullable: true })
  barcode: string;

  @Column({ type: 'decimal', precision: 20, scale: 2, default: 0, transformer: DecimalTransformer })
  cost_price: number;

  @Column({ type: 'decimal', precision: 20, scale: 2, default: 0, transformer: DecimalTransformer })
  sale_price: number;

  @Column({ type: 'decimal', precision: 20, scale: 3, default: 0, transformer: DecimalTransformer })
  stock: number;

  @Column({ type: 'decimal', precision: 20, scale: 3, default: 0, transformer: DecimalTransformer })
  reorder_level: number;

  @Column({ default: true })
  is_active: boolean;

  @CreateDateColumn({ type: "timestamp", default: () => "CURRENT_TIMESTAMP(6)" })
  created_at: Date;

  @UpdateDateColumn({ type: "timestamp", default: () => "CURRENT_TIMESTAMP(6)", onUpdate: "CURRENT_TIMESTAMP(6)" })
  updated_at: Date;
}
