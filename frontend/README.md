# IMS Client (React + Vite + Tailwind)

Frontend for the Inventory Management System backend (`backend/`).

```bash
cd frontend
cp .env.example .env        # VITE_API_BASE_URL=http://localhost:5000/api
npm install
npm run dev                 # http://localhost:5173
```
Backend must be running on port 5000 (`CLIENT_URL=http://localhost:5173` in backend/.env for CORS).
Login with a seeded user (`npm run seed:admin` / `seed:demo` in backend).
