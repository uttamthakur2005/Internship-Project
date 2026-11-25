# Backend integration guide

## Requirements and setup

- Node.js 20+ and npm
- MongoDB Atlas or a local replica set
- Set `MONGODB_URI`, `JWT_SECRET` (at least 32 characters), `JWT_EXPIRES_IN`, `CLIENT_URL`, and `TRANSACTIONS_ENABLED` in `backend/.env`.
- `TRANSACTIONS_ENABLED=true` is the default and recommended mode. Atlas and MongoDB replica sets support the required multi-document transactions. A standalone `mongod` does not.

```sh
cd backend
npm install
cp .env.example .env
# Edit .env and use strong, private values.
npm run seed:admin
npm run dev
```

The API listens on port 5000. Check `GET http://localhost:5000/api/health`. `npm run seed:admin` refuses to create another active administrator. For a fresh, empty non-production database, `npm run seed:demo` creates demo Admin/Manager/Staff users, 8 categories, 40 products, contacts, opening stock, a received purchase, and a confirmed sale. It uses `SEED_DEMO_PASSWORD` for all three accounts. Do not commit `.env` or use example credentials outside local setup.

## Local replica set

Start MongoDB with `mongod --replSet rs0`, run `rs.initiate()` once in `mongosh`, then set a URI such as `mongodb://127.0.0.1:27017/ims?replicaSet=rs0`.

## Transaction fallback

Setting `TRANSACTIONS_ENABLED=false` opts into the handbook's documented fallback. It claims the transaction status, applies conditional product updates, writes movement records after every line succeeds, and reverses successful stock updates if a later line fails. It is **not atomic**: a process crash or storage failure can leave partial changes. Run `npm run stock:verify` and review logs; use a replica set and transactions for reliable operation.

## Tests and health

`npm test` runs backend contract tests. `npm run stock:verify` checks that current product quantities equal the sum of all immutable movement deltas.
