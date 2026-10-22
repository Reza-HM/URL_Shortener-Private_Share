FROM node:24-bookworm-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm install --global pnpm@11.25.0
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM node:24-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000
RUN groupadd --system --gid 1001 relay && useradd --system --uid 1001 --gid relay relay
# Standalone web output plus the same dependency graph for typed migration and
# cleanup entrypoints. A future image-size pass can precompile these scripts.
COPY --from=build --chown=relay:relay /app/node_modules ./node_modules
COPY --from=build --chown=relay:relay /app/.next/standalone ./
COPY --from=build --chown=relay:relay /app/.next/static ./.next/static
COPY --from=build --chown=relay:relay /app/src ./src
COPY --from=build --chown=relay:relay /app/scripts ./scripts
COPY --from=build --chown=relay:relay /app/migrations ./migrations
COPY --from=build --chown=relay:relay /app/tsconfig.json ./tsconfig.json
RUN mkdir -p /app/data/payloads && chown -R relay:relay /app/data
USER relay
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
