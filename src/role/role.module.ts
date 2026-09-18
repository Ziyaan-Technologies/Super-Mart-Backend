import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PermissionModule } from 'src/permission/permission.module';
import { RoleController } from './role.controller';
import { RoleService } from './role.service';
import { Role } from './role.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Role], 'MainConnection'),
    PermissionModule
  ],
  controllers: [RoleController],
  providers: [RoleService],
  exports: [RoleService]
})
export class RoleModule { }
