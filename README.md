# Zeivio

Zeivio is a browser-based presentation studio with live audience interaction.

## Features

- Dashboard: create presentations from templates, search, duplicate and export portable JSON.
- Studio: drag/resize and group slide objects, text, uploaded images, shapes, icons and simple charts.
- Design: themes, per-slide colors, typography, layers, undo/redo, copy/paste, notes and autosave.
- Presentation: synchronized active slide, speaker notes, fullscreen, audience link and polling.
- Audience: participate in polls (one vote per anonymous browser ID), submit questions for moderation.
- Export: print the entire deck and save as PDF using the browser's Print dialog.
- Uploads: reusable per-user media library with MIME/file signature validation.

## Quick start

Node.js 22+ is required.

```bash
npm ci
cp backend/.env.example backend/.env
# Edit backend/.env: set JWT_SECRET to a securely generated random secret
# Keep DATABASE_URL=file:./dev.db for local SQLite development.
cd backend && npx prisma db push && cd ..
npm run dev
```

Frontend: http://localhost:3000 · Backend: http://localhost:4000/api

### Deployment

```bash
# Set JWT_SECRET in a private, untracked .env file at the repository root
docker compose up --build -d
```

The Compose setup includes the API and persists SQLite and uploaded media in a named volume. A production deployment also needs TLS, backups and proper frontend/backend public URLs.

Read [Studio & deployment documentation](docs/EDITOR_V2.md) before applying database schema changes. **Back up existing SQLite data before `prisma db push`; do not blindly pass `--accept-data-loss`.**

## Development and verification

```bash
npm run build
node --test backend/test/*.test.mjs
```

GitHub Actions runs Prisma validation, a disposable test database, backend/frontend builds, scene validation and a live API integration test.

## Architecture

- `frontend/`: Next.js + React + TypeScript.
- `backend/`: Express + Prisma + SQLite.
- `frontend/lib/scene.ts`: versioned slide scene contract, backward-compatible legacy rendering.
- `frontend/components/SlideSurface.tsx`: shared slide renderer for editor, presenter and audience.
- `backend/src/routes/media.ts`: authenticated media upload and listing.

## Roadmap

This release is **not yet feature-complete** against the Zeivio 2.0 product concept. Advanced rich text, full chart editing, transitions/animation, co-editing, server-side exports, PPTX imports, team permissions, analytics, scalable WebSocket/Redis sessions and PostgreSQL/object-storage production migration remain future milestones.
