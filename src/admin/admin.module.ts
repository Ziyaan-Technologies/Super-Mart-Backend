import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RoleModule } from 'src/role/role.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { Admin } from './models/admin.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Admin], 'MainConnection'),
    RoleModule
  ],
  controllers: [AdminController],
  providers: [AdminService],
  exports: [AdminService]
})
export class AdminModule { }
