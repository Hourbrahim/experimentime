## experimentime

Minimal “creative tools hub” website for the experimentime domain.

## Getting Started

Install dependencies and run the dev server:

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Project structure

- `data/tools.ts`: single source of truth for tools
- `components/ToolCard.tsx`: reusable tool card
- `app/page.tsx`: home page (`/`)
- `app/tools/[slug]/page.tsx`: dynamic tool page (`/tools/[slug]`)

## Build

```bash
npm run build
npm run start
```

## Deploy to Vercel

- Push this project to a Git repo (GitHub/GitLab/Bitbucket).
- In Vercel, click “New Project” and import the repo.
- Framework preset: **Next.js** (defaults are fine).
- Build command: `npm run build`
- Output: handled automatically by Next.js
- Click Deploy.

If you’re using a custom domain, add it in Vercel under **Project → Settings → Domains**.
