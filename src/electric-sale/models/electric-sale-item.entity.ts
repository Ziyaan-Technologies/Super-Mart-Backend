import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, RelationId } from 'typeorm';
import { DecimalTransformer } from 'src/common/decimal.transformer';
import { ElectricDocumentLine } from 'src/common/electric-document.entity';
import { ElectricSale } from './electric-sale.entity';

@Entity('electric_sale_items')
export class ElectricSaleItem extends ElectricDocumentLine {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => ElectricSale, (sale) => sale.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sale_id' })
  sale: ElectricSale;

  @RelationId((item: ElectricSaleItem) => item.sale)
  sale_id: number;

  @Column({ type: 'decimal', precision: 20, scale: 3, default: 0, transformer: DecimalTransformer })
  returned_quantity: number;

  @Column({ type: 'timestamp', nullable: true })
  cost_entered_at: Date;

  @Column({ nullable: true })
  cost_entered_by: number;
}
