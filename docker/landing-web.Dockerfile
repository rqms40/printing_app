FROM node:24-bookworm-slim AS build

WORKDIR /app/landing

COPY apps/Landing-page/package*.json ./
RUN npm ci

COPY apps/Landing-page ./

ARG VITE_API_URL
ARG VITE_MOBILE_WEB_PORT
ENV VITE_API_URL=${VITE_API_URL}
ENV VITE_MOBILE_WEB_PORT=${VITE_MOBILE_WEB_PORT}

RUN npm run build

FROM nginx:1.27-alpine

COPY docker/nginx/spa.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/landing/dist /usr/share/nginx/html

EXPOSE 80
