import { Column, Entity, PrimaryGeneratedColumn, Unique } from "typeorm";

export enum PermissionType {
  ADMIN = 'Admin',
  VENDOR = 'Vendor',
}

@Entity('permissions')
@Unique('UQ_permissions_key_type', ['permission_key', 'type'])
export class Permission {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column()
  permission_key: string;

  @Column()
  module_name: string;

  @Column({
    type: 'enum',
    enum: PermissionType,
  })
  type: PermissionType;
}
