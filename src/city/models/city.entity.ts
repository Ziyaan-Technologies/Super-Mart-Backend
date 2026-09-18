import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  RelationId,
  UpdateDateColumn
} from "typeorm";
import { Country } from "src/country/models/country.entity";
import { Area } from "src/area/models/area.entity";

@Entity('cities')
export class City {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @ManyToOne(() => Country, country => country.cities)
  @JoinColumn({ name: 'country_id' })
  country: Country;

  @RelationId((city: City) => city.country)
  country_id: number;

  @OneToMany(() => Area, area => area.city)
  areas: Area[];

  @Column({ default: true })
  is_active: boolean;

  @CreateDateColumn({ type: "timestamp", default: () => "CURRENT_TIMESTAMP(6)" })
  created_at: Date;

  @UpdateDateColumn({ type: "timestamp", default: () => "CURRENT_TIMESTAMP(6)", onUpdate: "CURRENT_TIMESTAMP(6)" })
  updated_at: Date;

  @DeleteDateColumn()
  public deleted_at: Date;
}
