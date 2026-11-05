# Zeivio Studio 2.0 – Development & Deployment

## Overview
- `frontend/lib/scene.ts`: versioned slide-scene schema. Legacy slide records are rendered without destructive migration.
- `frontend/components/SlideSurface.tsx`: shared renderer for studio, thumbnails, presenter, audience.
- `frontend/app/editor/[id]/page.tsx`: scene editor, design library, object dragging/resizing, layers, undo/redo, autosave.
- `backend/src/routes/media.ts`: authenticated binary image upload with signature and MIME validation, max 5 MB.
- `backend/src/controllers/public.ts`: active slide polling, one vote per participant UUID, moderated audience questions.

## Local setup
1. `npm ci`
2. Create `backend/.env` with `JWT_SECRET` set to 32+ random characters (for example via `openssl rand -hex 32`). Do NOT commit secrets.
3. IMPORTANT: `cd backend && npx prisma db push && cd ..`. Back up your existing `backend/prisma/dev.db` **before** changing the schema.
4. `npm run dev`; frontend http://localhost:3000, backend http://localhost:4000/api.
5. `npm run build` and `node --test backend/test/*.test.mjs` (test requires a prior backend build).

## Docker Compose
- Set `JWT_SECRET` via the host environment or a private `.env` next to Compose.
- Run `docker compose up --build -d`.
- SQLite (\`DATABASE_URL=file:/data/zeivio.db\`) + uploaded images live in the named `zeivio_data` volume, NOT Git.
- Default public URL assumes localhost. For deployment behind a TLS reverse proxy, set `PUBLIC_API_URL` to the public backend `https://.../api` and `PUBLIC_FRONTEND_ORIGIN` to the exact frontend origin before building.
- Images are publicly readable by unguessable filename; don't upload sensitive images.
- Never remove the named data volume without taking backups.

## Live sessions
1. Create or open a presentation, edit and save.
2. Use "Präsentieren", then "Live starten"; this publishes the presentation.
3. Audience opens `/p/{accessCode}`. The current slide changes via API polling (~2.5 seconds).
4. Polls accept one server-side vote per browser participant UUID.
5. Q&A questions require presenter moderation.
6. Stop the session in Presenter; the audience returns to the waiting screen.

## Known limitations / future work
- Live sync is **polling**, not WebSockets; no offline reconciliation.
- Uploaded images use local disk, not S3/R2; no asset management or orphan cleanup yet.
- Canvas currently provides basic objects/drag, resize, multi-select, layers, clipboard, history and themes, not rich-text selections, grouped objects, crop or transitions.
- Shared realtime co-editing, roles, team folders, collaborative comments, PDF/PPTX import/export, analytics dashboard and Redis/PostgreSQL migration remain open.
- Participant ID in localStorage prevents accidental repeat votes in the same browser, but is not a strong human identity; abuse controls and global rate limiting require additional hardening.
- `getPublicPresentationByCode` intentionally exposes only the active published slide during live sessions.
- Current SQLite repository snapshot is tracked historically; production must use external persistent storage and database backups.

**Migration warning:** For an existing database, back it up and review Prisma migration warnings. Do not use \`--accept-data-loss\` casually. CI runs against its own empty \`ci-test.db\`.
