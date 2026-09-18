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
import { City } from "src/city/models/city.entity";
import { Clientstore } from "src/clientstore/models/clientstore.entity";

export enum BusinessType {
    SUPERMARKET = 'Supermarket',
    HYPERMARKET = 'Hypermarket',
    GROCERY = 'Grocery',
    CONVENIENCE_STORE = 'Convenience Store',
    PHARMACY = 'Pharmacy',
}

@Entity('vendors')
export class Vendor {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    business_name: string;

    @Column({ nullable: true })
    owner_name: string;

    @Column({ unique: true })
    email: string;

    @Column({ nullable: true })
    phone: string;

    @Column({ nullable: true })
    address: string;

    @Column({ nullable: true })
    logo_url: string;

    @Column({
        type: 'enum',
        enum: BusinessType,
        default: BusinessType.SUPERMARKET
    })
    business_type: BusinessType;

    @Column({ nullable: true })
    tax_number: string;

    @ManyToOne(() => Country)
    @JoinColumn({ name: 'country_id' })
    country: Country;

    @RelationId((vendor: Vendor) => vendor.country)
    country_id: number;

    @ManyToOne(() => City, { nullable: true })
    @JoinColumn({ name: 'city_id' })
    city: City;

    @RelationId((vendor: Vendor) => vendor.city)
    city_id: number;

    @OneToMany(() => Clientstore, clientstore => clientstore.vendor)
    clientstores: Clientstore[];

    @Column({ default: false })
    allow_negative_stock: boolean;

    @Column({ default: true })
    is_active: boolean;

    @CreateDateColumn({ type: "timestamp", default: () => "CURRENT_TIMESTAMP(6)" })
    created_at: Date;

    @UpdateDateColumn({ type: "timestamp", default: () => "CURRENT_TIMESTAMP(6)", onUpdate: "CURRENT_TIMESTAMP(6)" })
    updated_at: Date;

    @DeleteDateColumn()
    public deleted_at: Date;
}
