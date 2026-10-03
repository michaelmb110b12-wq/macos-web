FROM node:22-bookworm-slim

WORKDIR /app

COPY package.json pnpm-lock.yaml ./

RUN corepack enable \
    && corepack prepare pnpm@10.18.3 --activate \
    && pnpm install --frozen-lockfile

COPY . .

RUN pnpm run build \
    && pnpm prune --prod

ENV NODE_ENV=production

EXPOSE 8080

CMD ["npm", "start"]
