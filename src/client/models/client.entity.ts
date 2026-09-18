import { Exclude } from "class-transformer";
import { Column, CreateDateColumn, DeleteDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, RelationId, UpdateDateColumn } from "typeorm";
import { Country } from "src/country/models/country.entity";
import { City } from "src/city/models/city.entity";
import { Clientstore } from "src/clientstore/models/clientstore.entity";
import { Vendor } from "src/vendor/models/vendor.entity";
import { Role } from "src/role/role.entity";

export enum ClientType {
	OWNER = 'Owner',
	SUPERVISOR = 'Supervisor'
}

@Entity('clients')
export class Client {
	@PrimaryGeneratedColumn()
	id: number;

	@Column({
		type: 'enum',
		enum: ClientType,
		default: ClientType.SUPERVISOR
	})
	client_type: ClientType;

	@Column()
	full_name: string;

	@Column({ unique: true })
	phone: string;

	@Column({ unique: true })
	email: string;

	@Column({ select: false })
	@Exclude()
	password: string;

	@Column({ nullable: true })
	image_url: string;

	@Column({ default: true })
	is_active: boolean;

	@Column({ default: 0, select: false })
	@Exclude()
	token_version: number;

	@ManyToOne(() => Vendor)
	@JoinColumn({ name: 'vendor_id' })
	vendor: Vendor;

	@RelationId((client: Client) => client.vendor)
	vendor_id: number;

	@ManyToOne(() => Clientstore, { nullable: true })
	@JoinColumn({ name: 'clientstore_id' })
	clientstore: Clientstore;

	@RelationId((client: Client) => client.clientstore)
	clientstore_id: number;

	@ManyToOne(() => Role)
	@JoinColumn({ name: 'role_id' })
	role: Role;

	@RelationId((client: Client) => client.role)
	role_id: number;

	@ManyToOne(() => Country, { nullable: true })
	@JoinColumn({ name: 'country_id' })
	country: Country;

	@RelationId((client: Client) => client.country)
	country_id: number;

	@ManyToOne(() => City, { nullable: true })
	@JoinColumn({ name: 'city_id' })
	city: City;

	@RelationId((client: Client) => client.city)
	city_id: number;

	@CreateDateColumn({ type: "timestamp", default: () => "CURRENT_TIMESTAMP(6)" })
	created_at: Date;

	@UpdateDateColumn({ type: "timestamp", default: () => "CURRENT_TIMESTAMP(6)", onUpdate: "CURRENT_TIMESTAMP(6)" })
	updated_at: Date;

	@DeleteDateColumn()
	public deleted_at: Date;
}
