# syntax = docker/dockerfile:1

# Adjust NODE_VERSION as desired
ARG NODE_VERSION=22.17.0
FROM node:${NODE_VERSION}-slim AS base

LABEL fly_launch_runtime="Astro"

# Astro app lives here
WORKDIR /app

# Set production environment
ENV NODE_ENV="production"
ARG strapi_url

# Install pnpm
ARG PNPM_VERSION=10.28.0
# Can probably just use corepack?
RUN npm install -g pnpm@$PNPM_VERSION


# Throw-away build stage to reduce size of final image
FROM base AS build

# Install packages needed to build node modules
RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y build-essential node-gyp pkg-config

# Install workspace node modules (this app is part of a pnpm workspace and
# depends on the sibling @burbridge/payload package, so the build context
# and lockfile installation both need to happen at the workspace root)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY patches ./patches
COPY web/package.json ./web/package.json
COPY payload/package.json ./payload/package.json
RUN pnpm install --frozen-lockfile

# Copy application code
COPY web ./web
COPY payload ./payload

ENV STRAPI_API=${strapi_url}
# Build application
# astro build calls into Payload at build time (getStaticPaths enumerates
# content pages), which needs PAYLOAD_SECRET/DATABASE_URL. Read via BuildKit
# secret mounts so the values never land in image layers/history.
RUN --mount=type=secret,id=PAYLOAD_SECRET \
    --mount=type=secret,id=DATABASE_URL \
    PAYLOAD_SECRET="$(cat /run/secrets/PAYLOAD_SECRET)" \
    DATABASE_URL="$(cat /run/secrets/DATABASE_URL)" \
    pnpm --filter ./web run build


# Final stage for app image
FROM nginx

# Copy built application
COPY --from=build /app/web/dist /usr/share/nginx/html

# Start the server by default, this can be overwritten at runtime
EXPOSE 80
CMD [ "/usr/sbin/nginx", "-g", "daemon off;" ]
