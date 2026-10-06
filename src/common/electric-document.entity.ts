import { Column } from 'typeorm';
import { DecimalTransformer } from 'src/common/decimal.transformer';

export enum ElectricDiscountType {
  PERCENT = 'percent',
  AMOUNT = 'amount',
}

export abstract class ElectricDocumentLine {
  @Column({ nullable: true })
  product_id: number;

  @Column({ nullable: true })
  variant_id: number;

  @Column()
  product_name: string;

  @Column({ default: '' })
  variant_name: string;

  @Column({ nullable: true })
  image_url: string;

  @Column({ type: 'decimal', precision: 20, scale: 3, default: 0, transformer: DecimalTransformer })
  quantity: number;

  @Column({ type: 'decimal', precision: 20, scale: 2, default: 0, transformer: DecimalTransformer })
  original_price: number;

  @Column({ type: 'decimal', precision: 20, scale: 2, default: 0, transformer: DecimalTransformer })
  unit_price: number;

  @Column({ type: 'enum', enum: ElectricDiscountType, default: ElectricDiscountType.PERCENT })
  discount_type: ElectricDiscountType;

  @Column({ type: 'decimal', precision: 20, scale: 2, default: 0, transformer: DecimalTransformer })
  discount_value: number;

  @Column({ nullable: true })
  bill_discount_code: string;

  @Column({ type: 'decimal', precision: 20, scale: 2, default: 0, transformer: DecimalTransformer })
  gross: number;

  @Column({ type: 'decimal', precision: 20, scale: 2, default: 0, transformer: DecimalTransformer })
  item_discount: number;

  @Column({ type: 'decimal', precision: 20, scale: 2, default: 0, transformer: DecimalTransformer })
  bill_discount: number;

  @Column({ type: 'decimal', precision: 20, scale: 2, default: 0, transformer: DecimalTransformer })
  total: number;

  @Column({ default: false })
  is_outside: boolean;

  @Column({ default: false })
  is_charge: boolean;

  @Column({ type: 'decimal', precision: 20, scale: 2, nullable: true, transformer: DecimalTransformer })
  cost_price: number;
}

export abstract class ElectricDocumentTotals {
  @Column({ nullable: true })
  debtor_id: number;

  @Column({ nullable: true })
  customer_name: string;

  @Column({ nullable: true })
  customer_phone: string;

  @Column({ type: 'text', nullable: true })
  note: string;

  @Column({ type: 'json', nullable: true })
  bill_discounts: any[];

  @Column({ type: 'decimal', precision: 20, scale: 2, default: 0, transformer: DecimalTransformer })
  subtotal: number;

  @Column({ type: 'decimal', precision: 20, scale: 2, default: 0, transformer: DecimalTransformer })
  item_discount: number;

  @Column({ type: 'decimal', precision: 20, scale: 2, default: 0, transformer: DecimalTransformer })
  bill_discount: number;

  @Column({ type: 'decimal', precision: 20, scale: 2, default: 0, transformer: DecimalTransformer })
  total_amount: number;
}
