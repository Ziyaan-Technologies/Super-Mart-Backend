import 'reflect-metadata';
import * as dotenv from 'dotenv';
import * as bcrypt from 'bcrypt';
import { DataSource, EntityManager, In, IsNull } from 'typeorm';
import dataSource from '../data-source';
import { catalogPermissions } from 'src/permission/permission-catalog';
import { Permission, PermissionType } from 'src/permission/permission.entity';
import { Role, RoleType } from 'src/role/role.entity';
import { Admin } from 'src/admin/models/admin.entity';
import { Country } from 'src/country/models/country.entity';
import { City } from 'src/city/models/city.entity';
import { Unit, UnitType } from 'src/unit/models/unit.entity';
import { seedDemo } from './demo-seed';

dotenv.config();

const vendorRoles: { name: string; legacy: string[]; keys: (key: string) => boolean }[] = [
    {
        name: 'Owner',
        legacy: [],
        keys: () => true,
    },
    {
        name: 'Manager',
        legacy: ['Store Manager'],
        keys: (key) => !['banks_create', 'banks_edit', 'banks_delete'].includes(key),
    },
    {
        name: 'Cashier',
        legacy: [],
        keys: (key) => ['pos_sell', 'pos_return'].includes(key),
    },
    {
        name: 'Product Entry',
        legacy: ['Inventory Clerk'],
        keys: (key) => [
            'products_view', 'products_create', 'products_edit', 'products_delete',
            'categories_view', 'categories_create', 'categories_edit', 'categories_delete',
            'brands_view', 'brands_create', 'brands_edit', 'brands_delete',
            'suppliers_view', 'suppliers_create', 'suppliers_edit',
            'taxes_view', 'stock_view', 'stock_opening',
            'purchase_orders_view', 'purchase_orders_create', 'purchase_orders_edit',
            'goods_receipts_view', 'goods_receipts_create', 'goods_receipts_edit', 'goods_receipts_post',
            'stock_transfers_view', 'stock_transfers_create', 'stock_transfers_edit', 'stock_transfers_dispatch', 'stock_transfers_receive',
            'stock_adjustments_view', 'stock_adjustments_create', 'stock_adjustments_edit',
        ].includes(key),
    },
];

async function syncPermissions(manager: EntityManager) {
    const catalog = catalogPermissions();
    const existing = await manager.find(Permission);
    for (const entry of catalog) {
        const found = existing.find((permission) => permission.permission_key === entry.permission_key && permission.type === entry.type);
        if (found) {
            if (found.module_name !== entry.module_name) {
                await manager.update(Permission, found.id, { module_name: entry.module_name });
            }
        } else {
            await manager.save(Permission, entry);
        }
    }
    const stale = existing.filter((permission) => !catalog.some((entry) => entry.permission_key === permission.permission_key && entry.type === permission.type));
    if (stale.length) {
        await manager.query('DELETE FROM role_permissions WHERE permission_id IN (?)', [stale.map((permission) => permission.id)]);
        await manager.delete(Permission, stale.map((permission) => permission.id));
    }
    console.log(`Permissions synced: ${catalog.length} in catalog, ${stale.length} removed`);
}

async function upsertSystemRole(manager: EntityManager, name: string, type: RoleType, permissions: Permission[], keepPermissions: boolean) {
    let role = await manager.findOne(Role, { where: { name, type, is_system: true, vendor: IsNull() }, relations: ['permissions'] });
    if (!role) {
        role = manager.create(Role, { name, type, is_system: true, vendor: null, permissions });
        await manager.save(Role, role);
        console.log(`Role created: ${name} (${permissions.length} permissions)`);
        return role;
    }
    if (keepPermissions) {
        console.log(`Role kept: ${name} (${role.permissions.length} permissions, edited in the admin panel)`);
        return role;
    }
    const missing = permissions.filter((permission) => !role.permissions.some((existing) => existing.id === permission.id));
    const removed = role.permissions.filter((existing) => !permissions.some((permission) => permission.id === existing.id));
    role.permissions = permissions;
    await manager.save(Role, role);
    console.log(`Role synced: ${name} (${missing.length} added, ${removed.length} removed)`);
    return role;
}

async function mergeLegacyRoles(manager: EntityManager, name: string, legacy: string[]) {
    if (!legacy.length) {
        return;
    }
    const system = { type: RoleType.VENDOR, is_system: true, vendor: IsNull() };
    const oldRoles = (await manager.find(Role, { where: legacy.map((oldName) => ({ ...system, name: oldName })) }))
        .sort((a, b) => legacy.indexOf(a.name) - legacy.indexOf(b.name));
    if (!oldRoles.length) {
        return;
    }
    let target = await manager.findOne(Role, { where: { ...system, name } });
    if (!target) {
        target = oldRoles.shift();
        await manager.update(Role, target.id, { name });
        console.log(`Role renamed: ${target.name} -> ${name}`);
    }
    for (const role of oldRoles) {
        await manager.query('UPDATE clients SET role_id = ? WHERE role_id = ?', [target.id, role.id]);
        await manager.query('DELETE FROM role_permissions WHERE role_id = ?', [role.id]);
        await manager.delete(Role, role.id);
        console.log(`Role merged: ${role.name} -> ${name}`);
    }
}

async function seedRoles(manager: EntityManager) {
    const adminPermissions = await manager.find(Permission, { where: { type: PermissionType.ADMIN } });
    const vendorPermissions = await manager.find(Permission, { where: { type: PermissionType.VENDOR } });
    await upsertSystemRole(manager, 'Super Admin', RoleType.ADMIN, adminPermissions, false);
    for (const role of vendorRoles) {
        await mergeLegacyRoles(manager, role.name, role.legacy);
        await upsertSystemRole(manager, role.name, RoleType.VENDOR, vendorPermissions.filter((permission) => role.keys(permission.permission_key)), true);
    }
}

async function seedUnits(manager: EntityManager) {
    const units = [
        { name: 'Piece', short_name: 'pcs', type: UnitType.PIECE, allow_decimal: false },
        { name: 'Pack', short_name: 'pack', type: UnitType.PIECE, allow_decimal: false },
        { name: 'Box', short_name: 'box', type: UnitType.PIECE, allow_decimal: false },
        { name: 'Dozen', short_name: 'dz', type: UnitType.PIECE, allow_decimal: false },
        { name: 'Kilogram', short_name: 'kg', type: UnitType.WEIGHT, allow_decimal: true },
        { name: 'Gram', short_name: 'g', type: UnitType.WEIGHT, allow_decimal: true },
        { name: 'Litre', short_name: 'L', type: UnitType.VOLUME, allow_decimal: true },
        { name: 'Millilitre', short_name: 'ml', type: UnitType.VOLUME, allow_decimal: true },
        { name: 'Metre', short_name: 'm', type: UnitType.LENGTH, allow_decimal: true },
    ];
    const existing = await manager.find(Unit, { where: { short_name: In(units.map((unit) => unit.short_name)) }, withDeleted: true });
    const missing = units.filter((unit) => !existing.some((row) => row.short_name === unit.short_name));
    if (missing.length) {
        await manager.save(Unit, missing);
    }
    console.log(`Units: ${missing.length} added`);
}

async function seedGeography(manager: EntityManager) {
    const countries = [
        { name: 'Pakistan', country_code: 'PK', phone_code: '+92', currency_short_name: 'PKR', currency_symbol: 'Rs', country_time_zone: 'Asia/Karachi', cities: ['Lahore', 'Karachi', 'Islamabad', 'Rawalpindi', 'Faisalabad'] },
        { name: 'United Kingdom', country_code: 'GB', phone_code: '+44', currency_short_name: 'GBP', currency_symbol: '£', country_time_zone: 'Europe/London', cities: ['London', 'Manchester', 'Birmingham', 'Leeds', 'Glasgow'] },
    ];
    for (const { cities, ...data } of countries) {
        let country = await manager.findOne(Country, { where: { country_code: data.country_code }, withDeleted: true });
        if (!country) {
            country = await manager.save(Country, data);
            await manager.save(City, cities.map((name) => ({ name, country: { id: country.id } })));
            console.log(`Country created: ${data.name}`);
        }
    }
}

async function seedSuperAdmin(manager: EntityManager) {
    const email = process.env.SEED_ADMIN_EMAIL;
    const password = process.env.SEED_ADMIN_PASSWORD;
    if (!email || !password) {
        console.log('SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD not set, skipping super admin');
        return;
    }
    if (await manager.findOne(Admin, { where: { email }, withDeleted: true })) {
        return;
    }
    const role = await manager.findOne(Role, { where: { name: 'Super Admin', type: RoleType.ADMIN, is_system: true } });
    const country = await manager.findOne(Country, { where: { country_code: 'PK' } });
    await manager.save(Admin, {
        full_name: 'Super Admin',
        email,
        phone: '+920000000000',
        password: await bcrypt.hash(password, 12),
        is_active: true,
        role: { id: role.id },
        country: country ? { id: country.id } : null,
    });
    console.log(`Super admin created: ${email}`);
}

async function run(source: DataSource) {
    await source.initialize();
    try {
        await source.transaction(async (manager) => {
            await syncPermissions(manager);
            await seedRoles(manager);
            await seedUnits(manager);
            await seedGeography(manager);
            await seedSuperAdmin(manager);
        });
        if (process.argv.includes('--demo')) {
            await source.transaction((manager) => seedDemo(manager));
        }
    } finally {
        await source.destroy();
    }
}

run(dataSource).catch((error) => {
    console.error(error);
    process.exit(1);
});
