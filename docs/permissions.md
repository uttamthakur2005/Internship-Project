# Permission matrix

The backend source of truth is `backend/src/config/permissions.js`. Authorization runs on every protected API request. Staff may only receive the explicit `sales.create` grant.

| Permission | Admin | Manager | Staff |
|---|---:|---:|---:|
| `users.manage` | Yes | No | No |
| `settings.manage` | Yes | No | No |
| `dashboard.view` | Yes | Yes | No |
| `products.view` | Yes | Yes | Yes (active products/categories) |
| `products.manage` | Yes | Yes | No |
| `stock.adjust` | Yes | Yes | No |
| `stock.view` | Yes | Yes | No |
| `contacts.manage` | Yes | Yes | No |
| `customers.view` | Yes | Yes | Yes |
| `purchases.manage` | Yes | Yes | No |
| `sales.view` | Yes | Yes | Own sales only |
| `sales.create` | Yes | Yes | Only when granted |
| `sales.cancel` | Yes | Yes | No; own drafts can be cancelled with `sales.create` |
| `reports.view` | Yes | Yes | No |

An authenticated user missing a required permission receives `403 FORBIDDEN`; a missing, invalid, expired, inactive-account, or revoked token receives `401`.
