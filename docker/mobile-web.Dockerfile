ARG FLUTTER_VERSION=3.41.6
FROM ghcr.io/cirruslabs/flutter:${FLUTTER_VERSION} AS build

WORKDIR /app/mobile

COPY apps/mobile/pubspec.* ./
RUN flutter pub get

COPY apps/mobile ./

ARG SERVER_URL
ARG ENABLE_DEV_AUTH=false
RUN flutter build web --release --no-tree-shake-icons \
    --dart-define=SERVER_URL=${SERVER_URL} \
    --dart-define=ENABLE_DEV_AUTH=${ENABLE_DEV_AUTH}

FROM nginx:1.27-alpine

COPY docker/nginx/spa.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/mobile/build/web /usr/share/nginx/html

EXPOSE 80
