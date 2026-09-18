import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, RelationId } from "typeorm";
import { DecimalTransformer } from "src/common/decimal.transformer";
import { SaleReturn } from "./sale-return.entity";
import { SaleItem } from "./sale-item.entity";

@Entity('sale_return_items')
export class SaleReturnItem {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => SaleReturn, saleReturn => saleReturn.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sale_return_id' })
  sale_return: SaleReturn;

  @RelationId((item: SaleReturnItem) => item.sale_return)
  sale_return_id: number;

  @ManyToOne(() => SaleItem)
  @JoinColumn({ name: 'sale_item_id' })
  sale_item: SaleItem;

  @RelationId((item: SaleReturnItem) => item.sale_item)
  sale_item_id: number;

  @Column({ type: 'decimal', precision: 18, scale: 3, transformer: DecimalTransformer })
  quantity: number;

  @Column({ type: 'decimal', precision: 20, scale: 2, default: 0, transformer: DecimalTransformer })
  refund_amount: number;
}
