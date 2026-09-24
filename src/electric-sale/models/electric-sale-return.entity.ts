import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, RelationId } from 'typeorm';
import { Clientstore } from 'src/clientstore/models/clientstore.entity';
import { Client } from 'src/client/models/client.entity';
import { DecimalTransformer } from 'src/common/decimal.transformer';
import { ElectricCounter } from 'src/electric-counter/models/electric-counter.entity';
import { ElectricCounterSession } from 'src/electric-counter/models/electric-counter-session.entity';
import { ElectricPaymentMethod, ElectricSale } from './electric-sale.entity';
import { ElectricSaleReturnItem } from './electric-sale-return-item.entity';

@Entity('electric_sale_returns')
export class ElectricSaleReturn {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  return_number: string;

  @ManyToOne(() => ElectricSale)
  @JoinColumn({ name: 'sale_id' })
  sale: ElectricSale;

  @RelationId((row: ElectricSaleReturn) => row.sale)
  sale_id: number;

  @ManyToOne(() => Clientstore)
  @JoinColumn({ name: 'clientstore_id' })
  clientstore: Clientstore;

  @RelationId((row: ElectricSaleReturn) => row.clientstore)
  clientstore_id: number;

  @ManyToOne(() => ElectricCounter)
  @JoinColumn({ name: 'counter_id' })
  counter: ElectricCounter;

  @RelationId((row: ElectricSaleReturn) => row.counter)
  counter_id: number;

  @ManyToOne(() => ElectricCounterSession)
  @JoinColumn({ name: 'session_id' })
  session: ElectricCounterSession;

  @RelationId((row: ElectricSaleReturn) => row.session)
  session_id: number;

  @ManyToOne(() => Client)
  @JoinColumn({ name: 'processed_by' })
  processed_by_client: Client;

  @RelationId((row: ElectricSaleReturn) => row.processed_by_client)
  processed_by: number;

  @Column({ type: 'enum', enum: ElectricPaymentMethod, default: ElectricPaymentMethod.CASH })
  refund_method: ElectricPaymentMethod;

  @Column()
  reason: string;

  @Column({ type: 'decimal', precision: 20, scale: 2, default: 0, transformer: DecimalTransformer })
  refund_amount: number;

  @Column({ type: 'decimal', precision: 20, scale: 2, default: 0, transformer: DecimalTransformer })
  khata_amount: number;

  @OneToMany(() => ElectricSaleReturnItem, (item) => item.sale_return)
  items: ElectricSaleReturnItem[];

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;
}
