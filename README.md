# Super Mart Backend

NestJS 10 + TypeORM + MySQL API for the Super Mart multi-store platform. It follows the same module layout as `Saas_api`: one folder per feature with `controller`, `service`, `module`, and `models/`.

## Setup

```bash
npm install
cp .env.example .env            # set DB credentials and a long random JWT_SECRET
mysql -uroot -e "CREATE DATABASE super_mart_dev CHARACTER SET utf8mb4"
npm run migration:run
npm run seed                    # permissions, system roles, units, countries, super admin
npm run seed -- --demo          # optional demo vendor, 1 store, products and opening stock
npm run start:dev               # http://localhost:4000/api
```

Demo accounts (after `--demo`):

| Panel | Email | Password | Notes |
| --- | --- | --- | --- |
| Admin | `admin@supermart.local` | `Admin@123` | Super Admin (from `SEED_ADMIN_*`) |
| Store | `owner@supermart.local` | `Owner@123` | Vendor owner with the Owner role, sees all stores |
| Store | `manager@supermart.local` | `Manager@123` | Manager, locked to Chaman Branch |
| Store | `cashier@supermart.local` | `Cashier@123` | Cashier, locked to Chaman Branch |
| Store | `entry@supermart.local` | `Entry@123` | Product Entry, locked to Chaman Branch |

## Schema changes

`synchronize` is off. After changing an entity:

```bash
npm run migration:generate -- src/database/migrations/DescribeChange
npm run migration:run
```

`npm run seed` is safe to re-run. It syncs the permission catalog and resets the permissions of the system roles (Super Admin and Manager get every permission).

## Tenancy

```
Admin ── Role (Admin)
Vendor ── Clientstore (branch) ── Client (Owner | Supervisor) ── Role (Vendor)
       └─ User (customer)
```

- Owners have no store and see every branch. Supervisors with a `clientstore_id` are locked to that branch on every endpoint.
- For store staff, `vendor_id` is always taken from the token and never from the request body.
- JWTs carry `{ id, type, ver }`. Logout or a password change bumps `token_version`, which revokes every older token.

## Permissions

- The catalog lives in `src/permission/permission-catalog.ts`. Keys look like `products_view` and `purchase_orders_approve`, and they are the same strings the Vue apps pass to CASL.
- Every protected route declares `@HasPermission('key', ...)`. The global `PermissionGuard` requires a valid token on every route except those marked `@Public()`.
- `@ActorTypes(...)` limits a route to admins, store staff, or customers.
- System roles: `Super Admin` for the admin panel, and four store roles:

  | Role | Permissions when first created |
  | --- | --- |
  | `Owner` | Every store permission. A new vendor's first login gets this role |
  | `Manager` | Every store permission |
  | `Cashier` | `pos_sell` only |
  | `Product Entry` | Products, categories, brands, suppliers, taxes (view), stock view and opening stock, purchase orders, goods receipts (including post), stock transfers, stock adjustments (without post) |

- The seed **creates** these roles if they are missing and then leaves their permissions alone, so what an admin ticks in the admin panel survives the next `npm run seed`. Only `Super Admin` is reset to every admin permission each run.
- Admins can add more store roles from the admin panel: a role with a `vendor_id` belongs to that vendor, and one without a `vendor_id` is offered to every vendor. Store staff see both in their role dropdown.
- Stores cannot create or edit roles; the `roles_*` and `permissions_*` keys are admin-only. The seed also renames older roles in place (`Store Manager` becomes `Manager`, `Inventory Clerk` becomes `Product Entry`) and moves their accounts over.
- A role cannot be deleted while any account still points at it — including soft-deleted accounts, which the API now reports as a plain message instead of failing.
- Staff who are not the owner can only grant, or manage accounts with, permissions their own role already has.

## Endpoint conventions

Each resource exposes the same shape:

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `<resource>/v1/kpis` | KPI cards |
| POST | `<resource>/v1/list` | Paginated list. Body: `page, take, search, status, sortBy, startDate, endDate` plus resource filters |
| GET | `<resource>/list` | Dropdown |
| POST / GET / PUT / DELETE | `<resource>`, `<resource>/:id` | CRUD |
| POST | `<resource>/export/excel` and `export/pdf` | Download |

Document workflows:

- `purchase-orders`: Draft → `PUT :id/approve` → received through goods receipts → Partially Received / Received. `PUT :id/cancel` is allowed before any receipt.
- `goods-receipts`: Draft → `PUT :id/post`. Posting adds stock, creates batches and updates the PO. It rejects over-receipts.
- `stock-transfers`: Draft → `PUT :id/dispatch` (source store) → `PUT :id/receive` (destination store, partial quantities allowed).
- `stock-adjustments`: Draft → `PUT :id/post`. A Count Correction uses the counted quantity. Damage and Expiry are booked as wastage.

## Stock engine

`StockService.applyMovement` is the only code that changes stock. It:

1. locks the `stocks` row for that store and variant,
2. blocks negative stock unless the vendor has `allow_negative_stock` on,
3. keeps a moving-average cost,
4. creates batches on the way in and consumes them earliest-expiry-first on the way out,
5. appends a row to `stock_movements` with the running balance.

Reports: `stock/v1/list` (on hand, low, out), `stock/v1/kpis`, `stock/v1/movements` (ledger), `stock/v1/expiry`, `stock/variant/:id`.

## POS

All routes are under `pos/` and only store staff can call them. A register session must be open at the store before a sale or a refund.

| Method | Path | Purpose | Permission |
| --- | --- | --- | --- |
| GET | `registers/current?clientstore_id` | Your open session here, or the branch where you have one open | `pos_sell` |
| POST | `registers/open` | Open with the counted cash | `pos_sell` |
| POST | `registers/v1/list`, `registers/:id/close`, GET `registers/:id` | Your sessions, or every session with `pos_manage`. Closing records the difference from expected cash | `pos_sell` or `pos_manage` |
| GET | `items`, `scan/:code`, `customers?q` | Item grid, barcode lookup, customer lookup by phone | `pos_sell` |
| POST | `sales/quote`, `sales` | Price a cart, create a bill | `pos_sell` (discounts also need `pos_discount`) |
| POST | `sales/v1/list`, `sales/v1/kpis` | Your bills, or every bill with `sales_view`. The list includes each bill's payments. Gross profit is only returned with `sales_view` | `pos_sell` or `sales_view` |
| GET | `sales/:id`, `sales/lookup/:billNumber`, `sales/:id/receipt` | Bill detail, lookup by number, 80 mm PDF receipt (counts reprints) | `pos_sell` or `sales_view` |
| POST | `sales/:id/return` | Refund quantities. Stock goes back at the original cost | `pos_return` |
| POST | `sales/export/:format` | Excel/PDF export | `sales_view` |

Pricing rules:

- A bill discount is spread across lines in proportion to their value.
- Tax-inclusive lines use tax = taxable × rate / (100 + rate).
- Payment methods are `Cash`, `Card` and `Online`. Only cash can be more than the total; the extra is returned as change.
- Bill numbers are `<STORE_CODE>-YYMM-00001`.
- A 13-digit barcode that starts with `2` is a scale label: digits 2–7 are the PLU (matched against a weighed variant's barcode or SKU) and digits 8–12 are the grams. The demo lentils use PLU `100200`.

Stock is deducted through `StockService.applyMovement` with `SALE` and `SALE_RETURN` movements, so batches are used earliest-expiry-first and each line keeps its cost for profit reports.

## Not built yet

Online orders and delivery, supplier payments, HR, and dashboards beyond the KPI endpoints.
