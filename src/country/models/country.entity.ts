import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn
} from "typeorm";
import { City } from "src/city/models/city.entity";

@Entity('countries')
export class Country {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ nullable: true })
  country_code: string;

  @Column({ nullable: true })
  phone_code: string;

  @Column({ nullable: true })
  currency_short_name: string;

  @Column({ nullable: true })
  currency_symbol: string;

  @Column({ nullable: true })
  country_time_zone: string;

  @Column({ default: true })
  is_active: boolean;

  @OneToMany(() => City, city => city.country)
  cities: City[];

  @CreateDateColumn({ type: "timestamp", default: () => "CURRENT_TIMESTAMP(6)" })
  created_at: Date;

  @UpdateDateColumn({ type: "timestamp", default: () => "CURRENT_TIMESTAMP(6)", onUpdate: "CURRENT_TIMESTAMP(6)" })
  updated_at: Date;

  @DeleteDateColumn()
  public deleted_at: Date;
}
