import { BadRequestException, Injectable } from '@nestjs/common';
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

    async assertUniqueKey(permissionKey: string, type: PermissionType, exceptId?: number) {
        const existing = await this.permissionRepository.findOne({ where: { permission_key: permissionKey, type } });
        if (existing && existing.id !== exceptId) {
            throw new BadRequestException(`The key "${permissionKey}" already exists for a ${type} permission`);
        }
    }

    async assertNotAssigned(id: number) {
        const [row] = await this.permissionRepository.query('SELECT COUNT(*) AS count FROM role_permissions WHERE permission_id = ?', [id]);
        if (Number(row.count)) {
            throw new BadRequestException('This permission is ticked in a role. Untick it there first.');
        }
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
