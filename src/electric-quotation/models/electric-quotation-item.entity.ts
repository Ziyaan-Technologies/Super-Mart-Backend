import { Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, RelationId } from 'typeorm';
import { ElectricDocumentLine } from 'src/common/electric-document.entity';
import { ElectricQuotation } from './electric-quotation.entity';

@Entity('electric_quotation_items')
export class ElectricQuotationItem extends ElectricDocumentLine {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => ElectricQuotation, (quotation) => quotation.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'quotation_id' })
  quotation: ElectricQuotation;

  @RelationId((item: ElectricQuotationItem) => item.quotation)
  quotation_id: number;
}
