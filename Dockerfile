# syntax=docker/dockerfile:1.7
# Multi-stage build. Final image runs as non-root `node` user (per plan
# security section).

# Build tools needed in case better-sqlite3 (or any native module) has to
# compile from source on musl. The runtime stage doesn't keep them.
FROM node:22-alpine AS deps
WORKDIR /app
RUN apk add --no-cache --virtual .build-deps python3 make g++
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev \
 && apk del .build-deps

FROM node:22-alpine AS build
WORKDIR /app
RUN apk add --no-cache --virtual .build-deps python3 make g++
COPY package.json package-lock.json* ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build \
 && apk del .build-deps

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps  /app/node_modules ./node_modules
COPY --from=build /app/dist         ./dist
COPY package.json ./
# Ensure /data (volume mount target) is writable by the non-root user.
RUN mkdir -p /data && chown -R node:node /data
USER node
CMD ["node", "--enable-source-maps", "dist/index.js"]
