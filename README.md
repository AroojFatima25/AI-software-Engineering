# AI-OS — The AI Software Engineering OS

Open AI software engineering platform — sign up and use specialized AI agents to
plan, architect, build, test, review, and document your software projects.

## Tech Stack

- **React 19** + **TypeScript 5.9** — UI and type safety
- **Vite 7** — dev server and production bundling (`vite-plugin-singlefile`)
- **Tailwind CSS 4** (via `@tailwindcss/vite`) — styling
- **React Router 7** — client-side routing
- **Framer Motion** — animations
- **Supabase** (`@supabase/supabase-js`) — authentication (email/password + Google OAuth)

## Getting Started

### Prerequisites

- Node.js 18+ (Node 20+ recommended)
- npm

### Install

```bash
npm install
```

### Environment variables

Copy the template and fill in your Supabase project values:

```bash
cp .env.example .env.local
```

| Variable | Description |
| --- | --- |
| `VITE_SUPABASE_URL` | Supabase project URL (Project Settings → API → Project URL) |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable (anon) API key |

> ⚠️ Only the two `VITE_` variables above belong in the frontend. The Supabase
> `service_role` secret key must never be placed here or in any `VITE_` var.

### Supabase dashboard configuration

The auth flows require these project settings (see `.env.example`):

- **Auth → Providers → Email**: enabled (password sign-up/sign-in)
- **Auth → Providers → Google**: enabled (OAuth)
- **Auth → URL Configuration → Site URL**: your production domain
- **Auth → URL Configuration → Redirect URLs**: allow-list every origin, e.g.
  `http://localhost:5173/**`, your Vercel preview domain, and your production
  domain. The password-reset email links to `<origin>/reset-password` and the
  sign-up confirmation email links to `<origin>/workspace`, so both paths must
  be covered by the wildcards.

### Run

```bash
npm run dev       # start dev server (http://localhost:5173)
```

### Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Vite dev server |
| `npm run typecheck` | Type-check with `tsc --noEmit` |
| `npm run build` | Production build |
| `npm run preview` | Preview the production build |

## Project Structure

```
ai-software-engineering-website (1)/
├── index.html                  # App shell (dark theme, fonts, favicon)
├── .env.example                # Environment variable template
└── src/
    ├── main.tsx                # Entry point
    ├── App.tsx                 # Routes
    ├── pages/                  # Route-level pages (About, Workspace, ...)
    ├── components/
    │   ├── auth/               # Auth provider, modals, password settings
    │   ├── layout/             # Header, Footer
    │   ├── sections/           # Landing page sections (Hero, Features, ...)
    │   ├── ui/                 # Buttons, icons, primitives, motion helpers
    │   └── workspace/          # Workspace UI (projects, runs, reviews, ...)
    ├── data/                   # Static content (agents, features, workflow, ...)
    ├── hooks/                  # Shared hooks (useWorkspace)
    └── lib/                    # Supabase client, auth and workspace helpers
```

## Deployment

The app is designed for deployment on **Vercel** (see `.env.example` notes):
set the two `VITE_` environment variables in Project Settings → Environment
Variables instead of a local `.env` file.
