FROM node:22-alpine
RUN apk add --no-cache openssl
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY prisma ./prisma
COPY tsconfig.json ./
COPY src ./src
ENV DATABASE_URL=file:/data/zeivio.db
RUN npm run build
RUN mkdir -p /data/uploads
ENV PORT=4000
ENV MEDIA_DIR=/data/uploads
EXPOSE 4000
CMD ["sh","-c","npx prisma db push --skip-generate && node dist/server.js"]
