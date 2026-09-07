# ptr_ui as a static build behind nginx.
#
# The dev server (`vue-cli-service serve`) stays on the dev box, where the
# hot-reload loop is worth having. This is for Kubernetes, where an image is
# the unit of deployment.
#
# node 16 on purpose: @vue/cli-service 3 is webpack 4, which uses an MD4 hash
# that OpenSSL 3 removed -- node 17+ fails with ERR_OSSL_EVP_UNSUPPORTED.
FROM node:16-bullseye AS build

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .

# Endpoints are NOT baked in: they come from config.js at run time (see
# src/runtime_config.js), so one image serves every deployment. The Google Maps
# key is the exception -- index.html interpolates it at build time -- so it is
# a build argument.
ARG PUBLIC_PATH=/
ARG VUE_APP_GOOGLE_MAPS_KEY=
ENV PUBLIC_PATH=$PUBLIC_PATH \
    VUE_APP_GOOGLE_MAPS_KEY=$VUE_APP_GOOGLE_MAPS_KEY \
    NODE_OPTIONS=--max-old-space-size=4096
RUN npx vue-cli-service build

# Source maps are 10.5MB next to a 4.6MB bundle and are of no use to anyone
# loading this over a tunnel. Kept out of the image rather than turned off in
# vue.config.js, so a local build still produces them.
RUN find /app/dist -name '*.map' -delete

FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html

# gzip is off in stock nginx, and this bundle is not small: the stylesheet
# alone is 7.5MB and chunk-vendors 3.9MB. Served raw through the tunnel the
# browser gave up on all three with ERR_HTTP2_PROTOCOL_ERROR while the same
# bytes fetched fine over HTTP/1.1.
#
# vue-router runs in history mode, so a deep link like /site/dpo-17/targets is
# not a file: without the fallback, refreshing on any route but / is a 404.
#
# The asset directories are excluded from that fallback on purpose. A missing
# bundle would otherwise be answered with index.html, and the browser reports
# that as "Unexpected token '<'" -- which reads like a build corruption rather
# than a missing file. Same for config.js, which must 404 honestly when a
# deployment forgets to provide one.
RUN printf '%s\n' \
    'server {' \
    '    listen 8082;' \
    '    root /usr/share/nginx/html;' \
    '    gzip on;' \
    '    gzip_vary on;' \
    '    gzip_proxied any;' \
    '    gzip_comp_level 6;' \
    '    gzip_min_length 1024;' \
    '    gzip_types text/plain text/css application/javascript application/json image/svg+xml application/manifest+json;' \
    '    location / { try_files $uri $uri/ /index.html; }' \
    '    location = /config.js { try_files $uri =404; }' \
    '    location /js/  { try_files $uri =404; }' \
    '    location /css/ { try_files $uri =404; }' \
    '    location /img/ { try_files $uri =404; }' \
    '}' > /etc/nginx/conf.d/default.conf
EXPOSE 8082
