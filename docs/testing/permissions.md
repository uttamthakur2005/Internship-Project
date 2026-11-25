# Permission test matrix

This is the expected permission contract for the backend. Run against a configured database and seeded Admin, Manager, Staff, and Staff-with-`sales.create` accounts before sign-off. The current automated suite verifies public health, unauthenticated `401`, and role permission defaults. Database-backed role/status evidence remains pending until a MongoDB replica set is configured.

| Request | Admin | Manager | Staff | Staff + `sales.create` | No token |
|---|---:|---:|---:|---:|---:|
| `GET /api/products` | 200 | 200 | 200 (active only) | 200 (active only) | 401 |
| `POST /api/products` | 201 | 201 | 403 | 403 | 401 |
| `POST /api/stock/adjustments` | 201 | 201 | 403 | 403 | 401 |
| `GET /api/stock/movements` | 200 | 200 | 403 | 403 | 401 |
| `POST /api/purchases` | 201 | 201 | 403 | 403 | 401 |
| `GET /api/sales` | 200 | 200 | 200 (own only) | 200 (own only) | 401 |
| `POST /api/sales` | 201 | 201 | 403 | 201 | 401 |
| `GET /api/dashboard/summary` | 200 | 200 | 403 | 403 | 401 |
| `PATCH /api/settings` | 200 | 403 | 403 | 403 | 401 |
| `POST /api/users` | 201 | 403 | 403 | 403 | 401 |

These are expected statuses, not a claim that the database-backed matrix has already been executed. Record actual statuses and account IDs after running the Postman collection/integration tests; never put passwords or JWTs in this document.
