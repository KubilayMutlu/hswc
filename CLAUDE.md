# HireSweet World Cup 2026 — Context for Claude

## Project Overview
Internal World Cup 2026 predictions app for HireSweet team (24 collaborators).
Built with React + Vite + TailwindCSS + Supabase (no separate backend).

## Stack
- **Frontend**: React 18, Vite, TypeScript, TailwindCSS, lucide-react, date-fns
- **Backend**: Supabase (PostgreSQL + Auth) — direct from frontend via @supabase/supabase-js
- **Deployment**: Vercel (connected to GitHub main branch)

## Key Files
- `src/App.tsx` — root component, auth state, tab routing
- `src/lib/supabase.ts` — Supabase client
- `src/types/index.ts` — TypeScript interfaces
- `supabase/schema.sql` — database schema + RLS policies
- `src/components/auth/LoginPage.tsx` — login form
- `src/components/layout/` — Topbar + Navigation
- `src/components/classement/ClassementPage.tsx` — leaderboard
- `src/components/pronostics/PronosticsPage.tsx` — prediction forms
- `src/components/matchs/MatchsPage.tsx` — match results & upcoming
- `src/components/defis/DefisPage.tsx` — 6 themed challenges
- `src/components/admin/AdminPage.tsx` — admin panel (score entry + match creation)

## Scoring System
- Correct winner (home/draw/away): **+3 pts**
- Exact score: **+8 pts** (replaces the 3, not additive)
- Wrong prediction: **0 pts**
- Points calculated by admin when entering final score via AdminPage

## Colors
- Primary: `#7C6FFF` (violet)
- Dark (topbar/nav): `#1A1F3C`
- Background: `#F8F9FF`

## Supabase
- Project URL: `https://vahmtwsqulzhmfnedlci.supabase.co`
- Tables: `profiles`, `matches`, `predictions`
- RLS enabled on all tables
- Admin accounts: set `is_admin = true` in `profiles` table via Supabase dashboard

## Development Commands
```bash
npm run dev      # Start dev server
npm run build    # Production build
npm run preview  # Preview production build
```

## Deployment (Vercel)
1. Push to `main` branch on GitHub
2. Vercel auto-deploys from connected repo
3. Set env vars in Vercel Dashboard:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

## Creating User Accounts
Accounts are created manually via Supabase Dashboard → Authentication → Users.
After creating a user, manually insert a row in `profiles`:
```sql
insert into profiles (id, full_name, avatar_initials, is_admin)
values ('<user-uuid>', 'Prénom Nom', 'PN', false);
```

## 24 Collaborators
Paul Bachelier, Adrien El Zein, Apollinaire Lecocq, Alice Goineau, Caroline Lamy,
Florent Muller, Florent Goupille, Hugo Nguyen Van, Julien Déoux, Kubilay Mutlu,
Léo Chassain, Mathieu Marseille, Paul Delhaye, Valériane Venance, Margaux Guillemot,
Adrien Leonetti, Clara Berard, Enzo Palla, Inaki Gauthier, Ismael Belghiti,
Kevin Goueffon, Maud Barnavon, Titouan Le Floch Riche, Ghaith Harzalli
