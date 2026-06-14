# syntax=docker/dockerfile:1

# ---- Build stage ----
# Pin Node 24 so the image builds with the same npm (11.x) that generated
# package-lock.json. This is what keeps `npm ci` from reporting the lockfile
# as "out of sync" — the resolution must match the npm that wrote it.
FROM node:24-alpine AS build
WORKDIR /app

# Install dependencies against the committed lockfile, reproducibly.
COPY package.json package-lock.json ./
RUN npm ci

# Build the static site (output: dist/).
COPY . .
RUN npm run build

# ---- handbuch stage ----
# Renders the Quarto handbuch to static HTML. Only the Quarto CLI is installed —
# no R/Python. Pages with code execution are served from the committed freeze
# cache (handbuch/_freeze/, produced by rendering locally), so the deploy build
# never runs R. Pages without code render directly.
FROM debian:bookworm-slim AS handbuch
ARG TARGETARCH
ARG QUARTO_VERSION=1.9.36
WORKDIR /app
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl ca-certificates \
    && curl -fsSL "https://github.com/quarto-dev/quarto-cli/releases/download/v${QUARTO_VERSION}/quarto-${QUARTO_VERSION}-linux-${TARGETARCH}.tar.gz" -o /tmp/quarto.tar.gz \
    && mkdir -p /opt/quarto \
    && tar -xzf /tmp/quarto.tar.gz -C /opt/quarto --strip-components=1 \
    && ln -s /opt/quarto/bin/quarto /usr/local/bin/quarto \
    && rm /tmp/quarto.tar.gz \
    && rm -rf /var/lib/apt/lists/*
# The handbuch reads ../templates/master.md and ../config/*.yaml as its single
# source of truth, so the whole repo must be present, not just handbuch/.
COPY . .
RUN quarto render handbuch

# ---- Serve stage ----
FROM nginx:1.27-alpine AS serve
COPY --from=build /app/dist /usr/share/nginx/html
# handbuch served as a sub-path: domain.com/handbuch/
COPY --from=handbuch /app/handbuch/_site /usr/share/nginx/html/handbuch
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
