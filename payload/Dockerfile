# To use this Dockerfile, you have to set `output: 'standalone'` in your next.config.mjs file.
# From https://github.com/vercel/next.js/blob/canary/examples/with-docker/Dockerfile

FROM node:22.17.0-slim AS base

# Pin pnpm here (rather than in each downstream stage) so every stage that
# derives from `base` gets a working pnpm without re-resolving/downloading
# it itself. Resolving from an empty WORKDIR (no package.json with a
# `packageManager` field) makes corepack fall back to the latest pnpm
# release, which isn't guaranteed to fetch cleanly.
RUN corepack enable pnpm && corepack prepare pnpm@10.34.5 --activate

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

# Install dependencies based on the preferred package manager. pnpm needs
# every workspace member's manifest present to resolve/hoist correctly, so
# copy payload's package.json into place (matching pnpm-workspace.yaml)
# even though the rest of the payload source isn't needed yet.
COPY pnpm-lock.yaml package.json pnpm-workspace.yaml ./
COPY payload/package.json ./payload/package.json
RUN pnpm i --frozen-lockfile


# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json /app/pnpm-workspace.yaml ./
COPY payload ./payload
COPY --from=deps /app/payload/node_modules ./payload/node_modules

# Next.js collects completely anonymous telemetry data about general usage.
# Learn more here: https://nextjs.org/telemetry
# Uncomment the following line in case you want to disable telemetry during the build.
# ENV NEXT_TELEMETRY_DISABLED 1

RUN pnpm --filter ./payload run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production
# Uncomment the following line in case you want to disable telemetry during runtime.
# ENV NEXT_TELEMETRY_DISABLED 1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Set the correct permission for prerender cache
RUN mkdir -p payload/.next
RUN chown nextjs:nodejs payload/.next

# Automatically leverage output traces to reduce image size. The standalone
# output is rooted at the pnpm workspace root (see outputFileTracingRoot in
# next.config.mjs), so it includes a nested payload/ dir whose node_modules
# symlinks resolve against the sibling node_modules copied alongside it.
# https://nextjs.org/docs/advanced-features/output-file-tracing
COPY --from=builder --chown=nextjs:nodejs /app/payload/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/payload/.next/static ./payload/.next/static

USER nextjs

EXPOSE 3000

ENV PORT 3000

# server.js is created by next build from the standalone output
# https://nextjs.org/docs/pages/api-reference/next-config-js/output
CMD HOSTNAME="0.0.0.0" node payload/server.js
