# syntax=docker/dockerfile:1

# 1. Build static files
FROM node:24-alpine AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile
COPY . .
# '/' for a domain root; '/<sub-path>/' when served under a prefix
ARG BASE_PATH=/
ENV BASE_PATH=${BASE_PATH}
RUN pnpm build

# 2. Serve with nginx
FROM nginx:1.29-alpine
# hosts like Render/Railway/Fly pass the port in $PORT
ENV PORT=80
COPY docker/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- "http://127.0.0.1:${PORT}/healthz" || exit 1
