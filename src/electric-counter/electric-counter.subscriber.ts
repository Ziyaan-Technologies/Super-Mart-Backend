import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntitySubscriberInterface, InsertEvent } from 'typeorm';
import { Clientstore } from 'src/clientstore/models/clientstore.entity';
import { BusinessType, Vendor } from 'src/vendor/models/vendor.entity';
import { ElectricCounter } from './models/electric-counter.entity';

@Injectable()
export class ElectricCounterSubscriber implements EntitySubscriberInterface<Clientstore> {
    constructor(@InjectDataSource('MainConnection') dataSource: DataSource) {
        dataSource.subscribers.push(this);
    }

    listenTo() {
        return Clientstore;
    }

    async afterInsert(event: InsertEvent<Clientstore>) {
        const vendorId = event.entity.vendor_id || (event.entity.vendor as any)?.id;
        if (!vendorId) {
            return;
        }
        const vendor = await event.manager.findOne(Vendor, { where: { id: vendorId } });
        if (vendor?.business_type !== BusinessType.ELECTRIC) {
            return;
        }
        await event.manager.save(ElectricCounter, {
            vendor: { id: vendorId },
            clientstore: { id: event.entity.id },
            name: 'Counter 1',
            description: '',
            drawer_cash: 0,
            is_active: true,
        });
    }
}
