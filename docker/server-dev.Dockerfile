FROM node:24-bookworm-slim

WORKDIR /app/server

COPY server/package*.json ./
RUN npm ci

COPY server ./

EXPOSE 3000

CMD ["npm", "run", "start"]
