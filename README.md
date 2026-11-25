# Inventory Management System

The repository is being initialized from the Agevole IMS MERN internship handbook. The current implementation is the Express/Mongoose backend in `backend/`; the React client has not been added yet.

## Run the API

Requirements: Node.js 20+, npm, and MongoDB running as an Atlas cluster or a local replica set (transactions enabled).

```sh
cd backend
npm install
cp .env.example .env
# Set MONGODB_URI and replace JWT_SECRET and seed credentials in .env.
npm run seed:admin
npm run dev
```

The API listens on port `5000`; `GET /api/health` is public. For local transactional development, use a single-node MongoDB replica set and include `?replicaSet=rs0` in `MONGODB_URI`.

For a fresh, empty development database, you can use `npm run seed:demo` instead of `seed:admin`. Set `SEED_DEMO_PASSWORD` first; this creates Admin, Manager, and Staff demo accounts, 8 categories, 40 products, contacts, and a purchase/sale lifecycle.

Run backend tests with `npm test` and verify current stock against movement history with `npm run stock:verify`.

## Documentation

- [API contract](docs/api-documentation.md)
- [Database schema](docs/database-schema.md)
- [Business rules and report definitions](docs/requirements.md)
- [Permission matrix](docs/permissions.md)
- [Backend integration and environment](docs/integration-guide.md)

If `TRANSACTIONS_ENABLED=false`, the handbook's fallback is used: it claims the status, applies conditional product updates, and reverses successful updates if a later line fails. It is not atomic; a process crash can leave partial changes, so reconcile stock with `npm run stock:verify`.
