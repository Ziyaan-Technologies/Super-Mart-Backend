import { Exclude } from 'class-transformer';
import { Column, CreateDateColumn, DeleteDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, RelationId, Unique, UpdateDateColumn } from 'typeorm';
import { Vendor } from 'src/vendor/models/vendor.entity';
import { City } from 'src/city/models/city.entity';
import { DecimalTransformer } from 'src/common/decimal.transformer';

export enum Gender {
	MALE = 'Male',
	FEMALE = 'Female',
	OTHER = 'Other',
}

@Entity('users')
@Unique('UQ_users_vendor_email', ['vendor', 'email'])
@Unique('UQ_users_vendor_phone', ['vendor', 'phone'])
export class User {
	@PrimaryGeneratedColumn()
	id: number;

	@Column()
	full_name: string;

	@Column()
	phone: string;

	@Column({ nullable: true })
	email: string;

	@Column({ nullable: true, select: false })
	@Exclude()
	password: string;

	@Column({ type: 'enum', enum: Gender, nullable: true })
	gender: Gender;

	@Column({ type: 'date', nullable: true })
	birthday: string;

	@Column({ nullable: true })
	address: string;

	@Column({ type: 'decimal', precision: 20, scale: 2, default: 0, transformer: DecimalTransformer })
	loyalty_points: number;

	@Column({ default: true })
	is_active: boolean;

	@Column({ default: 0, select: false })
	@Exclude()
	token_version: number;

	@ManyToOne(() => Vendor)
	@JoinColumn({ name: 'vendor_id' })
	vendor: Vendor;

	@RelationId((user: User) => user.vendor)
	vendor_id: number;

	@ManyToOne(() => City, { nullable: true })
	@JoinColumn({ name: 'city_id' })
	city: City;

	@RelationId((user: User) => user.city)
	city_id: number;

	@CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP(6)' })
	created_at: Date;

	@UpdateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP(6)', onUpdate: 'CURRENT_TIMESTAMP(6)' })
	updated_at: Date;

	@DeleteDateColumn()
	public deleted_at: Date;
}
