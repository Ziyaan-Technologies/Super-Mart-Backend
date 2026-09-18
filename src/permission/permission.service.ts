import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { AbstractService } from 'src/common/abstract.service';
import { Permission, PermissionType } from './permission.entity';

@Injectable()
export class PermissionService extends AbstractService {
    constructor(
        @InjectRepository(Permission, 'MainConnection') private readonly permissionRepository: Repository<Permission>
    ) {
        super(permissionRepository);
    }

    async findByIdsAndType(ids: number[], type: PermissionType): Promise<Permission[]> {
        if (!ids?.length) {
            return [];
        }
        return this.permissionRepository.find({ where: { id: In(ids), type } });
    }

    async findModules(type?: PermissionType): Promise<string[]> {
        const query = this.permissionRepository
            .createQueryBuilder('permission')
            .select('DISTINCT permission.module_name', 'module_name')
            .orderBy('permission.module_name', 'ASC');
        if (type) {
            query.where('permission.type = :type', { type });
        }
        const rows = await query.getRawMany();
        return rows.map((row) => row.module_name);
    }
}
