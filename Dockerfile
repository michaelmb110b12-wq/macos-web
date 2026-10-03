FROM node:22-bookworm-slim

WORKDIR /app

ENV NODE_ENV=production
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0

COPY package.json pnpm-lock.yaml ./

RUN corepack enable \
    && corepack prepare pnpm@10.18.3 --activate \
    && pnpm install --frozen-lockfile

COPY . .

RUN pnpm run build

EXPOSE 8080

CMD ["npm", "start"]
