import { PermissionType } from './permission.entity';

export interface CatalogModule {
    module_name: string;
    key: string;
    actions: string[];
}

const crud = ['view', 'create', 'edit', 'delete'];

export const ADMIN_PERMISSION_MODULES: CatalogModule[] = [
    { module_name: 'Home', key: 'home', actions: ['view'] },
    { module_name: 'Admins', key: 'admins', actions: crud },
    { module_name: 'Roles', key: 'roles', actions: crud },
    { module_name: 'Permissions', key: 'permissions', actions: ['view', 'edit'] },
    { module_name: 'Vendors', key: 'vendors', actions: crud },
    { module_name: 'Client Stores', key: 'client_stores', actions: crud },
    { module_name: 'Clients', key: 'clients', actions: crud },
    { module_name: 'Customers', key: 'customers', actions: crud },
    { module_name: 'Countries', key: 'countries', actions: crud },
    { module_name: 'Cities', key: 'cities', actions: crud },
    { module_name: 'Areas', key: 'areas', actions: crud },
    { module_name: 'Units', key: 'units', actions: crud },
    { module_name: 'Categories', key: 'categories', actions: ['view'] },
    { module_name: 'Brands', key: 'brands', actions: ['view'] },
    { module_name: 'Products', key: 'products', actions: ['view'] },
    { module_name: 'Stock', key: 'stock', actions: ['view'] },
];

export const VENDOR_PERMISSION_MODULES: CatalogModule[] = [
    { module_name: 'Home', key: 'home', actions: ['view'] },
    { module_name: 'Store', key: 'store', actions: crud },
    { module_name: 'Supervisor', key: 'supervisor', actions: crud },
    { module_name: 'Customers', key: 'customers', actions: crud },
    { module_name: 'Category', key: 'categories', actions: crud },
    { module_name: 'Brand', key: 'brands', actions: crud },
    { module_name: 'Tax', key: 'taxes', actions: crud },
    { module_name: 'Product', key: 'products', actions: crud },
    { module_name: 'Supplier', key: 'suppliers', actions: crud },
    { module_name: 'Purchase Order', key: 'purchase_orders', actions: [...crud, 'approve'] },
    { module_name: 'Goods Receipt', key: 'goods_receipts', actions: [...crud, 'post'] },
    { module_name: 'Stock', key: 'stock', actions: ['view', 'opening'] },
    { module_name: 'Stock Transfer', key: 'stock_transfers', actions: [...crud, 'dispatch', 'receive'] },
    { module_name: 'Stock Adjustment', key: 'stock_adjustments', actions: [...crud, 'post'] },
    { module_name: 'POS', key: 'pos', actions: ['sell', 'discount', 'return', 'manage'] },
    { module_name: 'Bank', key: 'banks', actions: crud },
    { module_name: 'Sales', key: 'sales', actions: ['view'] },
];

const actionLabel: Record<string, string> = {
    view: 'View',
    create: 'Create',
    edit: 'Edit',
    delete: 'Delete',
    approve: 'Approve',
    post: 'Post',
    opening: 'Opening Stock',
    dispatch: 'Dispatch',
    receive: 'Receive',
    sell: 'Use',
    discount: 'Give Discounts on',
    return: 'Process Returns on',
    manage: 'Manage Registers on',
};

export function catalogPermissions() {
    const build = (modules: CatalogModule[], type: PermissionType) =>
        modules.flatMap((module) =>
            module.actions.map((action) => ({
                name: `${actionLabel[action]} ${module.module_name}`,
                permission_key: `${module.key}_${action}`,
                module_name: module.module_name,
                type,
            })),
        );
    return [
        ...build(ADMIN_PERMISSION_MODULES, PermissionType.ADMIN),
        ...build(VENDOR_PERMISSION_MODULES, PermissionType.VENDOR),
    ];
}
