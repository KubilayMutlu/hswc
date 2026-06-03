# HireSweet World Cup 2026

Application de pronostics pour la Coupe du Monde 2026 — usage interne HireSweet.

## Setup

### 1. Clone & Install
```bash
git clone <repo-url>
cd hs-wc
npm install
```

### 2. Environment Variables
Copy `.env.example` to `.env` and fill in your Supabase credentials:
```bash
cp .env.example .env
```
```
VITE_SUPABASE_URL=https://vahmtwsqulzhmfnedlci.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
```

### 3. Supabase Setup
Run the SQL in `supabase/schema.sql` in the Supabase SQL editor:
- Creates tables: `profiles`, `matches`, `predictions`
- Enables Row Level Security on all tables
- Sets up auto-profile trigger on user signup

### 4. Create User Accounts
In Supabase Dashboard → Authentication → Users, create accounts for each team member.
Then insert their profiles:
```sql
insert into profiles (id, full_name, avatar_initials, is_admin)
values ('<uuid>', 'Prénom Nom', 'PN', false);
```

To make a user admin:
```sql
update profiles set is_admin = true where id = '<uuid>';
```

### 5. Run locally
```bash
npm run dev
```

## Deployment (Vercel)

1. Push to GitHub
2. Connect repo to Vercel
3. Set environment variables in Vercel Dashboard:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Push to `main` → auto-deploy

## Features

- **Classement** — Live leaderboard with podium, stats cards, progress bars
- **Pronostics** — Predict scores for upcoming matches (locked 5min before kickoff)
- **Matchs** — View results with prediction badges (+3 / exact / missed)
- **Défis** — 6 themed real-time challenges
- **Admin** — Enter final scores (auto-calculates points for all users), add matches

## Scoring
| Result | Points |
|--------|--------|
| Correct winner | +3 pts |
| Exact score | +8 pts |
| Wrong prediction | 0 pts |
