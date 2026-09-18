import { Column, CreateDateColumn, DeleteDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";

export enum UnitType {
  PIECE = 'Piece',
  WEIGHT = 'Weight',
  VOLUME = 'Volume',
  LENGTH = 'Length',
}

@Entity('units')
export class Unit {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  name: string;

  @Column({ unique: true })
  short_name: string;

  @Column({
    type: 'enum',
    enum: UnitType,
    default: UnitType.PIECE
  })
  type: UnitType;

  @Column({ default: false })
  allow_decimal: boolean;

  @Column({ default: true })
  is_active: boolean;

  @CreateDateColumn({ type: "timestamp", default: () => "CURRENT_TIMESTAMP(6)" })
  created_at: Date;

  @UpdateDateColumn({ type: "timestamp", default: () => "CURRENT_TIMESTAMP(6)", onUpdate: "CURRENT_TIMESTAMP(6)" })
  updated_at: Date;

  @DeleteDateColumn()
  public deleted_at: Date;
}
