# Backend business requirements

These rules follow the Agevole IMS handbook. Stock values are integer quantities; prices and totals are integer paise.

## Inventory business rules

1. `Product.stockQty` is current available stock. Only `stockService` writes it; product updates reject it. Reconciliation compares it with signed movement totals.
2. Receiving a purchase adds each line exactly once, only on `ordered → received`.
3. Confirming a sale deducts each line exactly once, only on `draft → confirmed`.
4. Draft purchases never change stock; only receipt invokes `stockService`.
5. Draft/cancelled sales never change stock; only confirmation invokes `stockService`. Cancellation is draft-only.
6. A sale is all-or-nothing. If any product lacks the requested stock, the complete confirmation fails.
7. Stock adjustments require `stock.adjust`, a canonical reason, positive integer quantity, and sufficient stock for an outgoing adjustment. `OTHER` requires a note.
8. Every stock mutation writes its immutable movement in the same transaction as the quantity update when transactions are enabled.
9. Retried requests cannot apply a second purchase receipt, sale confirmation, or opening-stock movement.
10. Received purchases and confirmed sales are read-only; snapshots are preserved; movements cannot be updated/deleted through the API.
11. The backend and Mongoose validate quantities, prices, totals, dates, and references. Client-supplied totals/statuses/stock quantities are not trusted.
12. Permissions and ownership are enforced on the server. Staff sales are scoped to their creator; server-controlled fields are set by services.

## Transaction lifecycles

```text
Purchase: draft --order--> ordered --receive--> received (final; stock in once)
          draft/ordered --cancel--> cancelled (no stock effect)

Sale:     draft --confirm--> confirmed (final; stock out once)
          draft --cancel--> cancelled (no stock effect)
```

Any invalid transition returns `409 INVALID_STATUS_TRANSITION`. A failed sale confirmation returns `409 INSUFFICIENT_STOCK` and does not partially deduct stock. Returns, reversals, and partial deliveries are out of MVP scope; corrections use a stock adjustment that cites the transaction reference.

## Dashboard and report calculations

| Metric | Source and calculation |
|---|---|
| Active products/categories | Count active products and active categories |
| Low stock | Active products where `0 < stockQty <= minStockLevel` |
| Out of stock | Active products where `stockQty = 0` |
| Estimated stock value | Active products: `sum(stockQty × (lastPurchaseCost ?? purchasePrice))`; operational estimate, not accounting valuation |
| Sales revenue | Confirmed sales with `confirmedAt` in the selected Asia/Kolkata date range; sum `total`; never profit |
| Purchase total | Received purchases with `receivedAt` in range; sum `total` |
| Movement summary | Count and sum of absolute quantity, grouped by canonical movement type and selected date range |
| Trends | Confirmed sales grouped by `confirmedAt`; received purchases grouped by `receivedAt`; daily or weekly in Asia/Kolkata |
| Current stock report | Product/category snapshots, quantity, stock status, and estimated value by row |
| Product movement report | Chronological movement records with before/after quantities and actor |

Reference: [permission matrix](./permissions.md), [schema](./database-schema.md), [API contract](./api-documentation.md).
