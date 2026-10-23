# One image with the backend, the web app and the on-device models. No keys are baked in.
#   docker build -t kanso .
#   docker run -p 3000:3000 -v kanso-models:/root/.cache/desert-ant-models kanso
# Then open http://localhost:3000. The volume keeps the on-device models (about 500 MB) between runs.

FROM node:25.4.0-bookworm-slim AS build
RUN npm install -g pnpm@12.11.2
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/backend/package.json apps/backend/
COPY apps/frontend/package.json apps/frontend/
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm --filter @kanso/backend build && pnpm --filter @kanso/frontend build

FROM node:25.4.0-bookworm-slim
# The in-memory MongoDB needs libcurl, and the models download over https on first start.
RUN apt-get update && apt-get install -y --no-install-recommends libcurl4 ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=build /app /app
RUN cd apps/backend && node -e "import('mongodb-memory-server').then((m) => m.MongoBinary.getPath())"
ENV NODE_ENV=production \
    PORT=3000 \
    WEB_DIR=/app/apps/frontend/dist \
    EXTENSIONS_DIR=/app/extensions \
    MCP_AUTH=required
EXPOSE 3000
CMD ["node", "apps/backend/dist/main"]
