# Backend API contract

Base URL: `http://localhost:5000/api`. Protected calls use `Authorization: Bearer <token>`. Request bodies are JSON; dates are ISO 8601 and all money values are integer paise. Lists accept `page` (1), `limit` (20, max 100), `sort`, and module-specific filters.

Success responses use `{ "success": true, "data": ..., "message": "..." }`; lists also return `meta` with page, limit, total, and totalPages. Errors use `{ "success": false, "error": { "code": "...", "message": "...", "details": [] } }`.

| Method | Path | Permission | Purpose |
|---|---|---|---|
| GET | `/health` | Public | API health |
| POST | `/auth/login` | Public | Login; returns token, expiry, user, and effective permissions |
| GET | `/auth/me` | Authenticated | Current user and permissions |
| POST | `/auth/logout` | Authenticated | Increment token version; revoke sessions |
| PATCH | `/auth/me` | Authenticated | Update own name/phone |
| PATCH | `/auth/me/password` | Authenticated | Change password and revoke sessions |
| GET/POST | `/users` | `users.manage` | List or create users |
| GET/PATCH | `/users/:id` | `users.manage` | Read or update user |
| PATCH | `/users/:id/status` | `users.manage` | Activate/deactivate; last-admin and self protections apply |
| GET/PATCH | `/settings` | Authenticated / `settings.manage` | Read or update singleton settings |
| GET | `/categories` | `products.view` | List/search categories |
| POST | `/categories` | `products.manage` | Create category |
| PATCH | `/categories/:id` | `products.manage` | Edit or deactivate category |
| GET/POST | `/products` | `products.view` / `products.manage` | List/search or create product |
| GET/PATCH | `/products/:id` | `products.view` / `products.manage` | Read or update product |
| PATCH | `/products/:id/status` | `products.manage` | Activate/deactivate product |
| GET/POST | `/suppliers` | `contacts.manage` | List or create supplier |
| GET/PATCH | `/suppliers/:id` | `contacts.manage` | Read, edit, or deactivate supplier |
| GET | `/suppliers/:id/purchases` | `contacts.manage` | Supplier transaction history |
| GET | `/customers` | `customers.view` | List customers |
| POST | `/customers` | `contacts.manage` | Create customer |
| GET | `/customers/:id` | `customers.view` | Read customer |
| PATCH | `/customers/:id` | `contacts.manage` | Edit or deactivate customer |
| GET | `/customers/:id/sales` | `sales.view` | Customer sales history; staff see their own |
| POST | `/stock/opening` | `stock.adjust` | Set opening stock once per product |
| POST | `/stock/adjustments` | `stock.adjust` | Stock adjustment with reason |
| GET | `/stock/movements` | `stock.view` | Filter movement history |
| GET/POST | `/purchases` | `purchases.manage` | List or create a draft purchase |
| GET/PATCH | `/purchases/:id` | `purchases.manage` | Read or edit a draft purchase |
| POST | `/purchases/:id/order` | `purchases.manage` | Draft → ordered |
| POST | `/purchases/:id/receive` | `purchases.manage` | Ordered → received and add stock once |
| POST | `/purchases/:id/cancel` | `purchases.manage` | Cancel draft/ordered purchase |
| GET/POST | `/sales` | `sales.view` / `sales.create` | List or create a draft sale |
| GET/PATCH | `/sales/:id` | `sales.view` / `sales.create` | Read or edit draft sale; staff are owner-scoped |
| POST | `/sales/:id/confirm` | `sales.create` | Confirm sale and deduct stock once |
| POST | `/sales/:id/cancel` | `sales.cancel` or own-draft `sales.create` | Cancel draft sale |
| GET | `/dashboard/summary` | `dashboard.view` | Counts, alerts, recent transactions, movements, totals |
| GET | `/dashboard/trends` | `dashboard.view` | Sales/purchase totals by day or week; `from`, `to`, `interval` |
| GET | `/reports/stock` | `reports.view` | Current stock; optional CSV output |
| GET | `/reports/low-stock` | `reports.view` | Active products with `0 < stockQty <= minStockLevel` |
| GET | `/reports/out-of-stock` | `reports.view` | Active products with zero stock |
| GET | `/reports/purchases` | `reports.view` | Received purchases by `receivedAt` |
| GET | `/reports/sales` | `reports.view` | Confirmed sales by `confirmedAt` |
| GET | `/reports/movements` | `reports.view` | Movement history |

`POST /products` always initializes `stockQty` to zero. Product updates reject `stockQty` and `lastPurchaseCost`; all stock changes run through `stockService`. Purchase/sale lines must contain unique products; totals and historical snapshots are server-generated.

Common error codes: `VALIDATION_ERROR` (400), `UNAUTHENTICATED`, `TOKEN_EXPIRED`, `ACCOUNT_INACTIVE` (401), `FORBIDDEN` (403), `NOT_FOUND` (404), `DUPLICATE_KEY`, `INVALID_STATUS_TRANSITION`, `INSUFFICIENT_STOCK`, `OPENING_STOCK_EXISTS` (409), `TOO_MANY_REQUESTS` (429), and `INTERNAL_ERROR` (500).

## Request fields and validation

| Endpoint(s) | Request body / query | Server validation and behavior |
|---|---|---|
| `POST /auth/login` | `{ "email": "admin@example.com", "password": "..." }` | Valid email and non-empty password. Login failures return the same `401 UNAUTHENTICATED` message. |
| `PATCH /auth/me` | `{ "name"?, "phone"? }` | Own name is 2–60 characters; only name and phone may be updated. |
| `PATCH /auth/me/password` | `{ "currentPassword", "newPassword" }` | Verifies current password; new password is 8–128 characters; increments token version. |
| `POST /users` | `{ "name", "email", "role", "password", "phone"?, "extraPermissions"? }` | Role is admin/manager/staff; password 8–128 characters; only Staff may receive `sales.create`. |
| `PATCH /users/:id` | `{ "name"?, "phone"?, "role"?, "extraPermissions"? }` | Same role/grant checks; does not accept password, active state, or token version. |
| `PATCH /users/:id/status` | `{ "isActive": boolean }` | Blocks self-deactivation and deactivation/demotion of the last active admin. |
| `PATCH /settings` | `companyName`, `currency`, `defaultMinStockLevel`, `purchasePrefix`, `salePrefix` | Admin permission; INR only; minimum stock is a non-negative integer. |
| `POST /categories` | `{ "name", "description"? }` | Name is 2–50 characters; case-insensitive unique index. PATCH accepts name/description/isActive. |
| `POST /products` | `{ "name", "sku", "category", "unit", "purchasePrice", "sellingPrice", "minStockLevel"?, "description"?, "barcode"? }` | SKU is uppercased and must match `^[A-Z0-9-]{3,30}$`; prices/quantities are non-negative integer paise/units; category must be active. Stock and last purchase cost are server-controlled. |
| `GET /products` | `search`, `category`, `status`, `stockStatus=low|out|ok`, `sort`, `page`, `limit` | Only documented sort fields and active/inactive/stock filter values are accepted. Staff see active products only. |
| `POST /suppliers` | `{ "name", "phone", "contactPerson"?, "email"?, "address"? }` | Name 2–100 characters; phone is 10–15 digits; valid email when supplied. |
| `POST /customers` | `{ "name", "phone"?, "email"?, "address"? }` | Name 2–100 characters; optional phone is 10–15 digits; valid email when supplied. |
| `POST /stock/opening` | `{ "productId", "quantity", "unitCost", "note" }` | Positive integer quantity, non-negative integer paise cost, one opening movement per product. |
| `POST /stock/adjustments` | `{ "productId", "direction":"in|out", "quantity", "reason", "note"? }` | Positive integer quantity; reason is a canonical adjustment enum; `OTHER` requires a note; stock cannot become negative. |
| `GET /stock/movements` | `product`, `type`, `from`, `to`, `page`, `limit` | Movement type is one of the five canonical values; dates are inclusive Asia/Kolkata calendar days. |
| `POST /purchases` | `{ "supplier", "purchaseDate", "items":[{"product","quantity","unitCost"}], "notes"? }` | Active supplier/products; at least one unique product; positive integer quantity; non-negative integer paise cost; totals/snapshots are server-calculated. |
| `PATCH /purchases/:id` | Any of `supplier`, `purchaseDate`, `items`, `notes` | Draft purchases only; totals/snapshots are recalculated. |
| `POST /purchases/:id/cancel` | `{ "reason" }` | Non-empty reason; draft or ordered only. |
| `POST /sales` | `{ "customer"?, "saleDate", "items":[{"product","quantity","unitPrice"?}] }` | Active products/customer; walk-in when customer omitted; price defaults to current selling price; quantities positive integer; totals/snapshots are server-calculated. |
| `PATCH /sales/:id` | Any of `customer`, `saleDate`, `items` | Draft only; Staff may edit only their own sale. |
| `POST /sales/:id/cancel` | `{ "reason" }` | Non-empty reason; draft only; Staff may cancel only their own draft. |
| `GET /purchases`, `GET /sales` | `status`, `supplier`/`customer`, `from`, `to`, `search`, `sort`, `page`, `limit` | Status and date ranges are validated; Staff sales queries are owner-scoped. |
| `GET /dashboard/trends` | `from`, `to`, `interval=day|week` | At least one date is required; from cannot be after to. Sales use confirmedAt; purchases use receivedAt. |
| `GET /reports/purchases`, `GET /reports/sales` | `from`, `to`, `supplier`/`customer`, `page`, `limit` | Received/confirmed records only; totals use receivedAt/confirmedAt respectively. |
| `GET /reports/stock` | `category`, `search`, `sort`, `format=csv`, `page`, `limit` | Current stock and estimated value use last purchase cost (or purchase price fallback). |

### Example responses

```json
{
  "success": true,
  "data": { "referenceNo": "PUR-2026-00007", "status": "draft", "total": 1200 }
}
```

```json
{
  "success": false,
  "error": {
    "code": "INSUFFICIENT_STOCK",
    "message": "Not enough stock for PEN-01",
    "details": [{ "field": "items", "message": "Requested 12, available 7", "sku": "PEN-01" }]
  }
}
```

## Postman references

Import [`backend/tests/IMS-API.postman_collection.json`](../backend/tests/IMS-API.postman_collection.json), set its `adminEmail` and `adminPassword` variables to the seed admin credentials, and run in order after the API and MongoDB replica set are running. It covers login, health, authenticated access, category/product creation, opening stock, movement history, supplier, purchase order/receipt, sale confirmation, and stock report. Automated contract tests are in `backend/tests/api.test.js`; transaction failure/retry cases still require a configured MongoDB replica set.
