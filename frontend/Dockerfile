FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
COPY frontend/package.json ./frontend/package.json
COPY backend/package.json ./backend/package.json
RUN npm ci
COPY frontend ./frontend
ARG NEXT_PUBLIC_API_URL=http://localhost:4000/api
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN npm run build --workspace frontend
WORKDIR /app/frontend
EXPOSE 3000
CMD ["npm", "start"]
