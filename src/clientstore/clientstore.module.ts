import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClientstoreController } from './clientstore.controller';
import { ClientstoreService } from './clientstore.service';
import { Clientstore } from './models/clientstore.entity';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([Clientstore], 'MainConnection'),
  ],
  controllers: [ClientstoreController],
  providers: [ClientstoreService],
  exports: [ClientstoreService]
})
export class ClientstoreModule { }
