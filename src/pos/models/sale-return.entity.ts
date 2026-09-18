import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, RelationId } from "typeorm";
import { Vendor } from "src/vendor/models/vendor.entity";
import { Clientstore } from "src/clientstore/models/clientstore.entity";
import { Client } from "src/client/models/client.entity";
import { DecimalTransformer } from "src/common/decimal.transformer";
import { Sale } from "./sale.entity";
import { SaleReturnItem } from "./sale-return-item.entity";
import { PaymentMethod } from "./sale-payment.entity";
import { RegisterSession } from "./register-session.entity";

@Entity('sale_returns')
export class SaleReturn {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true, nullable: true })
  return_number: string;

  @ManyToOne(() => Sale)
  @JoinColumn({ name: 'sale_id' })
  sale: Sale;

  @RelationId((saleReturn: SaleReturn) => saleReturn.sale)
  sale_id: number;

  @ManyToOne(() => Vendor)
  @JoinColumn({ name: 'vendor_id' })
  vendor: Vendor;

  @RelationId((saleReturn: SaleReturn) => saleReturn.vendor)
  vendor_id: number;

  @ManyToOne(() => Clientstore)
  @JoinColumn({ name: 'clientstore_id' })
  clientstore: Clientstore;

  @RelationId((saleReturn: SaleReturn) => saleReturn.clientstore)
  clientstore_id: number;

  @ManyToOne(() => RegisterSession, { nullable: true })
  @JoinColumn({ name: 'register_session_id' })
  register_session: RegisterSession;

  @RelationId((saleReturn: SaleReturn) => saleReturn.register_session)
  register_session_id: number;

  @ManyToOne(() => Client)
  @JoinColumn({ name: 'processed_by_id' })
  processed_by: Client;

  @OneToMany(() => SaleReturnItem, item => item.sale_return)
  items: SaleReturnItem[];

  @Column({
    type: 'enum',
    enum: PaymentMethod,
  })
  refund_method: PaymentMethod;

  @Column({ type: 'decimal', precision: 20, scale: 2, default: 0, transformer: DecimalTransformer })
  refund_amount: number;

  @Column({ nullable: true })
  reason: string;

  @CreateDateColumn({ type: "timestamp", default: () => "CURRENT_TIMESTAMP(6)" })
  created_at: Date;
}
