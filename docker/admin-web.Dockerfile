FROM node:24-bookworm-slim AS build

WORKDIR /app/admin

COPY admin/package*.json ./
RUN npm ci

COPY admin ./

ARG VITE_API_URL
ARG VITE_WS_URL
ARG VITE_GOOGLE_MAPS_API_KEY=
ENV VITE_API_URL=${VITE_API_URL}
ENV VITE_WS_URL=${VITE_WS_URL}
ENV VITE_GOOGLE_MAPS_API_KEY=${VITE_GOOGLE_MAPS_API_KEY}

RUN npm run build

FROM nginx:1.27-alpine

COPY docker/nginx/spa.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/admin/dist /usr/share/nginx/html

EXPOSE 80
