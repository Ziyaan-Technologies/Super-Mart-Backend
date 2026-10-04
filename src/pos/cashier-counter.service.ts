import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { RoleService } from 'src/role/role.service';
import { Client, ClientType } from 'src/client/models/client.entity';
import { PosCounter } from './models/pos-counter.entity';

// Every cashier gets a counter of their own at their branch and can only sell from it.
// A cashier is staff who can sell but cannot manage the POS.
@Injectable()
export class CashierCounterService {
    constructor(
        private roleService: RoleService,
        @InjectDataSource('MainConnection') private readonly dataSource: DataSource,
    ) { }

    async isCashier(roleId: number) {
        const keys = await this.roleService.permissionKeys(roleId);
        return keys.has('pos_sell') && !keys.has('pos_manage');
    }

    async nextCounterName(storeId: number) {
        const repository = this.dataSource.getRepository(PosCounter);
        let number = await repository.count({ where: { clientstore: { id: storeId } }, withDeleted: true }) + 1;
        while (await repository.findOne({ where: { clientstore: { id: storeId }, name: `Counter ${number}` } })) {
            number++;
        }
        return `Counter ${number}`;
    }

    // Gives the cashier a counter at their branch if they don't have one there yet, and clears
    // the assignment from anyone who is no longer a cashier.
    async sync(clientId: number) {
        const clients = this.dataSource.getRepository(Client);
        const counters = this.dataSource.getRepository(PosCounter);
        const client = await clients.findOne({ where: { id: clientId } });
        if (!client) {
            return null;
        }
        const cashier = client.client_type === ClientType.SUPERVISOR && !!client.clientstore_id && (await this.isCashier(client.role_id));
        if (!cashier) {
            if (client.pos_counter_id) {
                await clients.update(client.id, { pos_counter_id: null });
            }
            return null;
        }
        if (client.pos_counter_id) {
            const current = await counters.findOne({ where: { id: client.pos_counter_id } });
            if (current && current.clientstore_id === client.clientstore_id) {
                return current;
            }
        }
        const counter = await counters.save({
            vendor: { id: client.vendor_id },
            clientstore: { id: client.clientstore_id },
            name: await this.nextCounterName(client.clientstore_id),
            description: `${client.full_name}'s counter`,
            is_active: true,
        });
        await clients.update(client.id, { pos_counter_id: counter.id });
        return counter;
    }

    async syncAll() {
        const staff = await this.dataSource.getRepository(Client).find({ where: { client_type: ClientType.SUPERVISOR } });
        for (const client of staff) {
            await this.sync(client.id);
        }
    }
}
