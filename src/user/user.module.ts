import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { User } from './models/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([User], 'MainConnection'),
  ],
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService]
})
export class UserModule { }
