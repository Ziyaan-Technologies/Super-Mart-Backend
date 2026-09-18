import * as bcrypt from 'bcrypt';
import { EntityManager, IsNull } from 'typeorm';
import { Vendor, BusinessType } from 'src/vendor/models/vendor.entity';
import { Clientstore } from 'src/clientstore/models/clientstore.entity';
import { Client, ClientType } from 'src/client/models/client.entity';
import { Role, RoleType } from 'src/role/role.entity';
import { Country } from 'src/country/models/country.entity';
import { City } from 'src/city/models/city.entity';
import { Category } from 'src/category/models/category.entity';
import { Brand } from 'src/brand/models/brand.entity';
import { Tax } from 'src/tax/models/tax.entity';
import { Unit } from 'src/unit/models/unit.entity';
import { Supplier } from 'src/supplier/models/supplier.entity';
import { Product } from 'src/product/models/product.entity';
import { ProductVariant } from 'src/product/models/product-variant.entity';
import { Stock } from 'src/stock/models/stock.entity';
import { StockBatch } from 'src/stock/models/stock-batch.entity';
import { StockMovement, StockMovementType } from 'src/stock/models/stock-movement.entity';
import { StockService } from 'src/stock/stock.service';

const catalog = [
    {
        department: 'Grocery',
        categories: [
            {
                name: 'Rice & Flour',
                products: [
                    { name: 'Basmati Rice', brand: 'Guard', unit: 'kg', weighted: false, expiry: false, variants: [['1 kg', 'RICE-1KG', '8961000100011', 1, 330, 450, 20], ['5 kg', 'RICE-5KG', '8961000100028', 5, 1580, 2150, 10]] },
                    { name: 'Chakki Atta', brand: null, unit: 'kg', weighted: false, expiry: false, variants: [['10 kg', 'ATTA-10KG', '8961000100035', 10, 960, 1320, 8]] },
                ],
            },
            {
                name: 'Loose Items',
                products: [
                    { name: 'Red Lentils (Masoor)', brand: null, unit: 'kg', weighted: true, expiry: false, variants: [['Loose', 'DAL-MASOOR', '100200', 1, 245, 340, 15]] },
                ],
            },
        ],
    },
    {
        department: 'Dairy',
        categories: [
            {
                name: 'Milk',
                products: [
                    { name: 'Olpers Full Cream Milk', brand: 'Olpers', unit: 'L', weighted: false, expiry: true, variants: [['1 L', 'OLP-1L', '8964000100017', 1, 212, 290, 30], ['250 ml', 'OLP-250ML', '8964000100024', 0.25, 62, 85, 48]] },
                    { name: 'Nestle Milkpak', brand: 'Nestle', unit: 'L', weighted: false, expiry: true, variants: [['1 L', 'MPK-1L', '8964000200014', 1, 216, 295, 30]] },
                ],
            },
        ],
    },
    {
        department: 'Beverages',
        categories: [
            {
                name: 'Soft Drinks',
                products: [
                    { name: 'Coca-Cola', brand: 'Coca-Cola', unit: 'L', weighted: false, expiry: true, variants: [['1.5 L', 'COKE-1.5L', '5449000000996', 1.5, 150, 210, 24], ['345 ml Can', 'COKE-345', '5449000131805', 0.345, 78, 110, 48]] },
                ],
            },
        ],
    },
    {
        department: 'Personal Care',
        categories: [
            {
                name: 'Soap',
                products: [
                    { name: 'Lifebuoy Soap', brand: 'Lifebuoy', unit: 'pcs', weighted: false, expiry: false, variants: [['Single', 'LFB-SGL', '8961006100019', 1, 86, 120, 36], ['Pack of 4', 'LFB-4PK', '8961006100026', 4, 325, 450, 12]] },
                ],
            },
        ],
    },
];

export async function seedDemo(manager: EntityManager) {
    if (await manager.findOne(Vendor, { where: { email: 'demo@supermart.local' }, withDeleted: true })) {
        console.log('Demo vendor already exists, skipping demo data');
        return;
    }
    const country = await manager.findOneOrFail(Country, { where: { country_code: 'PK' } });
    const city = await manager.findOneOrFail(City, { where: { name: 'Lahore' } });
    const ownerRole = await manager.findOneOrFail(Role, { where: { name: 'Owner', type: RoleType.VENDOR, is_system: true, vendor: IsNull() } });
    const managerRole = await manager.findOneOrFail(Role, { where: { name: 'Manager', type: RoleType.VENDOR, is_system: true, vendor: IsNull() } });
    const cashierRole = await manager.findOneOrFail(Role, { where: { name: 'Cashier', type: RoleType.VENDOR, is_system: true, vendor: IsNull() } });
    const entryRole = await manager.findOneOrFail(Role, { where: { name: 'Product Entry', type: RoleType.VENDOR, is_system: true, vendor: IsNull() } });

    const vendor = await manager.save(Vendor, {
        business_name: 'Demo Super Mart',
        owner_name: 'Demo Owner',
        email: 'demo@supermart.local',
        phone: '+924200000000',
        address: 'Main Boulevard, Lahore',
        business_type: BusinessType.SUPERMARKET,
        country: { id: country.id },
        city: { id: city.id },
        is_active: true,
    });

    const mainStore = await manager.save(Clientstore, {
        vendor: { id: vendor.id }, store_name: 'Chaman Branch', store_code: 'MAIN', store_phone: '+924200000001',
        address: 'Main Boulevard, Lahore', country: { id: country.id }, city: { id: city.id },
        opening_time: '08:00', closing_time: '23:00', is_active: true,
    });

    await manager.save(Client, [
        {
            client_type: ClientType.OWNER, full_name: 'Demo Owner', email: 'owner@supermart.local', phone: '+923000000001',
            password: await bcrypt.hash('Owner@123', 12), is_active: true, vendor: { id: vendor.id }, role: { id: ownerRole.id },
            country: { id: country.id }, city: { id: city.id },
        },
        {
            client_type: ClientType.SUPERVISOR, full_name: 'Chaman Branch Manager', email: 'manager@supermart.local', phone: '+923000000002',
            password: await bcrypt.hash('Manager@123', 12), is_active: true, vendor: { id: vendor.id }, role: { id: managerRole.id },
            clientstore: { id: mainStore.id }, country: { id: country.id }, city: { id: city.id },
        },
        {
            client_type: ClientType.SUPERVISOR, full_name: 'Chaman Branch Cashier', email: 'cashier@supermart.local', phone: '+923000000003',
            password: await bcrypt.hash('Cashier@123', 12), is_active: true, vendor: { id: vendor.id }, role: { id: cashierRole.id },
            clientstore: { id: mainStore.id }, country: { id: country.id }, city: { id: city.id },
        },
        {
            client_type: ClientType.SUPERVISOR, full_name: 'Chaman Branch Product Entry', email: 'entry@supermart.local', phone: '+923000000004',
            password: await bcrypt.hash('Entry@123', 12), is_active: true, vendor: { id: vendor.id }, role: { id: entryRole.id },
            clientstore: { id: mainStore.id }, country: { id: country.id }, city: { id: city.id },
        },
    ]);

    const tax = await manager.save(Tax, { vendor: { id: vendor.id }, name: 'GST 18%', rate: 18, is_active: true });
    await manager.save(Tax, { vendor: { id: vendor.id }, name: 'Exempt', rate: 0, is_active: true });
    await manager.save(Supplier, [
        { vendor: { id: vendor.id }, name: 'Metro Distributors', contact_person: 'Ali Raza', phone: '+923001112233', email: 'orders@metro-dist.local', city: { id: city.id }, payment_terms_days: 30, is_active: true },
        { vendor: { id: vendor.id }, name: 'Fresh Dairy Supply', contact_person: 'Sana Khan', phone: '+923004445566', city: { id: city.id }, payment_terms_days: 7, is_active: true },
    ]);

    const brandNames = ['Guard', 'Olpers', 'Nestle', 'Coca-Cola', 'Lifebuoy'];
    const brands = new Map<string, Brand>();
    for (const name of brandNames) {
        brands.set(name, await manager.save(Brand, { vendor: { id: vendor.id }, name, is_active: true }));
    }
    const units = new Map((await manager.find(Unit)).map((unit) => [unit.short_name, unit]));

    const stockService = new StockService(
        manager.getRepository(Stock),
        manager.getRepository(StockBatch),
        manager.getRepository(StockMovement),
        manager.getRepository(ProductVariant),
        manager.connection,
    );

    let sortOrder = 0;
    for (const department of catalog) {
        const parent = await manager.save(Category, { vendor: { id: vendor.id }, name: department.department, level: 1, sort_order: sortOrder++, is_active: true });
        for (const group of department.categories) {
            const category = await manager.save(Category, { vendor: { id: vendor.id }, parent: { id: parent.id }, name: group.name, level: 2, is_active: true });
            for (const item of group.products) {
                const product = await manager.save(Product, {
                    vendor: { id: vendor.id },
                    category: { id: category.id },
                    brand: item.brand ? { id: brands.get(item.brand).id } : null,
                    unit: { id: units.get(item.unit).id },
                    tax: { id: tax.id },
                    name: item.name,
                    is_weighted: item.weighted,
                    track_expiry: item.expiry,
                    price_includes_tax: true,
                    is_active: true,
                });
                for (const [name, sku, barcode, unitQuantity, cost, price, reorder] of item.variants as any[]) {
                    const variant = await manager.save(ProductVariant, {
                        vendor: { id: vendor.id }, product: { id: product.id }, name, sku, barcode,
                        unit_quantity: unitQuantity, cost_price: cost, sale_price: price, reorder_level: reorder, is_active: true,
                    });
                    const stores = [[mainStore.id, reorder * 4]];
                    for (const [clientstoreId, quantity] of stores) {
                        await stockService.applyMovement(manager, {
                            vendorId: vendor.id,
                            clientstoreId,
                            variantId: variant.id,
                            type: StockMovementType.OPENING,
                            quantity,
                            unitCost: cost,
                            batches: item.expiry
                                ? [{ batch_number: `B-${sku}-01`, expiry_date: new Date(Date.now() + (sku.startsWith('OLP') ? 10 : 120) * 86400000).toISOString().slice(0, 10), quantity, unit_cost: cost }]
                                : [],
                            trackExpiry: item.expiry,
                            allowNegative: true,
                            reference: { type: 'opening', id: null, number: 'OPENING' },
                            note: 'Demo opening stock',
                        });
                    }
                }
            }
        }
    }
    console.log('Demo data created: owner@supermart.local / Owner@123, manager@supermart.local / Manager@123, cashier@supermart.local / Cashier@123, entry@supermart.local / Entry@123');
}
