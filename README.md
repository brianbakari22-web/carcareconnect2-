# Car Care Connect

Full-stack automotive service platform — Supabase + React.

## Setup (5 minutes)

### 1. Run the database schema
- Open [supabase.com/dashboard](https://supabase.com/dashboard)
- Go to your project → **SQL Editor**
- Paste and run the entire contents of `supabase_schema.sql`

### 2. Install and run
```bash
cd car-care-connect
npm install
npm run dev
```
App runs at http://localhost:5173

### 3. Create your first admin
- Register an account at `/auth` with any email
- In Supabase SQL Editor run:
  ```sql
  update profiles set role = 'admin' where id = '<paste-your-user-id>';
  ```
  (Find your user ID in Supabase → Authentication → Users)

## Architecture

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite |
| Auth | Supabase Auth (JWT) |
| Database | Supabase PostgreSQL |
| Realtime | Supabase Realtime (WebSockets) |
| Security | Row Level Security on all tables |

## Features built

- **4-role auth** — Customer, Provider, Driver, Admin
- **Real-time bookings** — status updates pushed instantly via WebSocket
- **Customer**: browse services, book with promo codes, vehicle management, loyalty points
- **Provider**: manage services, confirm/decline bookings, earnings tracking
- **Driver**: online/offline toggle, accept concierge jobs
- **Admin**: user management (verify/suspend), live booking feed, platform stats

## Deployment (Cloudflare Pages)
```bash
npm run build
# Upload the `dist/` folder to Cloudflare Pages
```
