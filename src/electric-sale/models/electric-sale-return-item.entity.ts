import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, RelationId } from 'typeorm';
import { DecimalTransformer } from 'src/common/decimal.transformer';
import { ElectricSaleReturn } from './electric-sale-return.entity';

@Entity('electric_sale_return_items')
export class ElectricSaleReturnItem {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => ElectricSaleReturn, (row) => row.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sale_return_id' })
  sale_return: ElectricSaleReturn;

  @RelationId((item: ElectricSaleReturnItem) => item.sale_return)
  sale_return_id: number;

  @Column()
  sale_item_id: number;

  @Column()
  product_name: string;

  @Column({ default: '' })
  variant_name: string;

  @Column({ type: 'decimal', precision: 20, scale: 3, default: 0, transformer: DecimalTransformer })
  quantity: number;

  @Column({ type: 'decimal', precision: 20, scale: 2, default: 0, transformer: DecimalTransformer })
  unit_price: number;

  @Column({ type: 'decimal', precision: 20, scale: 2, default: 0, transformer: DecimalTransformer })
  refund_amount: number;
}
