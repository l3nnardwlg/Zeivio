FROM node:22-alpine
RUN apk add --no-cache openssl
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json ./backend/package.json
COPY frontend/package.json ./frontend/package.json
RUN npm ci
COPY backend/prisma ./backend/prisma
COPY backend/tsconfig.json ./backend/tsconfig.json
COPY backend/src ./backend/src
ENV DATABASE_URL=file:/data/zeivio.db
RUN npm run build --workspace backend
RUN mkdir -p /data/uploads
ENV PORT=4000
ENV MEDIA_DIR=/data/uploads
WORKDIR /app/backend
EXPOSE 4000
CMD ["sh","-c","npx prisma db push --skip-generate && node dist/server.js"]
