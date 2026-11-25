# Database schema

Mongoose models use timestamps and camelCase fields. Money is stored as integer paise.

| Model | Core fields and rules |
|---|---|
| User | `name`, unique lowercase `email`, hidden `passwordHash`, `role` (`admin/manager/staff`), `extraPermissions` (Staff may receive `sales.create`), `isActive`, `tokenVersion`, login/audit fields |
| Setting | Singleton key `app`, company name, INR currency, default minimum stock, purchase/sale prefixes |
| Counter | Prefix/year `_id`, incrementing sequence for references |
| Category | Unique case-insensitive name, description, active state, creator |
| Product | Unique uppercase SKU; category, unit, prices, optional unique barcode, `stockQty`, `minStockLevel`, active/inactive state, audit users |
| Supplier / Customer | Contact information, address, active state, creator |
| Purchase | Unique reference, supplier and snapshot, unique-product line snapshots, integer totals, draft/ordered/received/cancelled lifecycle and actor timestamps |
| Sale | Unique reference, optional customer and snapshot (walk-in supported), unique-product line snapshots, integer totals, draft/confirmed/cancelled lifecycle and actor timestamps |
| StockMovement | Product and snapshot, canonical type, signed integer delta, before/after quantities, optional cost/reference, reason/note, actor; append-only |

Stock movement types are `OPENING`, `PURCHASE_IN`, `SALE_OUT`, `ADJUSTMENT_IN`, and `ADJUSTMENT_OUT`. Adjustment reasons are `COUNT_CORRECTION`, `DAMAGED`, `LOST`, `FOUND`, `EXPIRED`, and `OTHER`. Opening stock and adjustments carry a reason; `OTHER` adjustments require a note.

Products, categories, contacts, and users referenced by history are deactivated, not deleted. Completed purchase/sale snapshots and movement history are immutable through the API. Product `stockQty` is only modified through the shared stock service. A unique partial index prevents duplicate purchase/sale movement rows for the same product and transaction; a second partial index permits one opening movement per product.

The reconciliation script compares each product's current `stockQty` to the sum of its signed movements.
