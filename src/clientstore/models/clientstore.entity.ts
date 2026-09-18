import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  RelationId,
  Unique,
  UpdateDateColumn
} from 'typeorm';
import { Vendor } from "src/vendor/models/vendor.entity";
import { Country } from "src/country/models/country.entity";
import { City } from "src/city/models/city.entity";
import { Area } from "src/area/models/area.entity";
import { DecimalTransformer } from "src/common/decimal.transformer";

@Entity('client_stores')
@Unique('UQ_client_stores_vendor_code', ['vendor', 'store_code'])
export class Clientstore {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Vendor, vendor => vendor.clientstores)
  @JoinColumn({ name: 'vendor_id' })
  vendor: Vendor;

  @RelationId((clientstore: Clientstore) => clientstore.vendor)
  vendor_id: number;

  @Column()
  store_name: string;

  @Column()
  store_code: string;

  @Column({ nullable: true })
  store_phone: string;

  @Column({ nullable: true })
  store_email: string;

  @Column({ nullable: true })
  address: string;

  @Column({ nullable: true })
  lat: string;

  @Column({ nullable: true })
  lng: string;

  @Column({ nullable: true })
  image_url: string;

  @ManyToOne(() => Country)
  @JoinColumn({ name: 'country_id' })
  country: Country;

  @RelationId((clientstore: Clientstore) => clientstore.country)
  country_id: number;

  @ManyToOne(() => City)
  @JoinColumn({ name: 'city_id' })
  city: City;

  @RelationId((clientstore: Clientstore) => clientstore.city)
  city_id: number;

  @ManyToOne(() => Area, { nullable: true })
  @JoinColumn({ name: 'area_id' })
  area: Area;

  @RelationId((clientstore: Clientstore) => clientstore.area)
  area_id: number;

  @Column({ type: 'time', nullable: true })
  opening_time: string;

  @Column({ type: 'time', nullable: true })
  closing_time: string;

  @Column({ default: true })
  is_pos_active: boolean;

  // Cash carried in the counter drawer: the next counter opens with it, closing a counter sets it to the counted cash.
  @Column({ type: 'decimal', precision: 20, scale: 2, default: 0, transformer: DecimalTransformer })
  drawer_cash: number;

  @Column({ default: false })
  is_delivery_active: boolean;

  @Column({ default: true })
  is_active: boolean;

  @CreateDateColumn({ type: "timestamp", default: () => "CURRENT_TIMESTAMP(6)" })
  created_at: Date;

  @UpdateDateColumn({ type: "timestamp", default: () => "CURRENT_TIMESTAMP(6)", onUpdate: "CURRENT_TIMESTAMP(6)" })
  updated_at: Date;

  @DeleteDateColumn()
  public deleted_at: Date;
}
