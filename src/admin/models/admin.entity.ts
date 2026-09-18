import { Exclude } from 'class-transformer';
import {
	Column,
	CreateDateColumn,
	DeleteDateColumn,
	Entity,
	JoinColumn,
	ManyToOne,
	PrimaryGeneratedColumn,
	RelationId,
	UpdateDateColumn,
} from 'typeorm';
import { Role } from 'src/role/role.entity';
import { Country } from 'src/country/models/country.entity';
import { City } from 'src/city/models/city.entity';

@Entity('admins')
export class Admin {
	@PrimaryGeneratedColumn()
	id: number;

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

	@ManyToOne(() => Role)
	@JoinColumn({ name: 'role_id' })
	role: Role;

	@RelationId((admin: Admin) => admin.role)
	role_id: number;

	@ManyToOne(() => Country, { nullable: true })
	@JoinColumn({ name: 'country_id' })
	country: Country;

	@RelationId((admin: Admin) => admin.country)
	country_id: number;

	@ManyToOne(() => City, { nullable: true })
	@JoinColumn({ name: 'city_id' })
	city: City;

	@RelationId((admin: Admin) => admin.city)
	city_id: number;

	@CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP(6)' })
	created_at: Date;

	@UpdateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP(6)', onUpdate: 'CURRENT_TIMESTAMP(6)' })
	updated_at: Date;

	@DeleteDateColumn()
	public deleted_at: Date;
}
