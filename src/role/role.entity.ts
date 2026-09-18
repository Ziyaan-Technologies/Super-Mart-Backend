import { Column, CreateDateColumn, Entity, JoinColumn, JoinTable, ManyToMany, ManyToOne, PrimaryGeneratedColumn, RelationId, UpdateDateColumn } from "typeorm";
import { Permission } from "src/permission/permission.entity";
import { Vendor } from "src/vendor/models/vendor.entity";

export enum RoleType {
  ADMIN = 'Admin',
  VENDOR = 'Vendor',
}

@Entity('roles')
export class Role {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({
    type: 'enum',
    enum: RoleType,
  })
  type: RoleType;

  @Column({ default: false })
  is_system: boolean;

  @ManyToOne(() => Vendor, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'vendor_id' })
  vendor: Vendor;

  @RelationId((role: Role) => role.vendor)
  vendor_id: number;

  @ManyToMany(() => Permission)
  @JoinTable({
    name: 'role_permissions',
    joinColumn: { name: 'role_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'permission_id', referencedColumnName: 'id' }
  })
  permissions: Permission[];

  @CreateDateColumn({ type: "timestamp", default: () => "CURRENT_TIMESTAMP(6)" })
  created_at: Date;

  @UpdateDateColumn({ type: "timestamp", default: () => "CURRENT_TIMESTAMP(6)", onUpdate: "CURRENT_TIMESTAMP(6)" })
  updated_at: Date;
}
