FROM node:22-alpine

WORKDIR /app

# Copy the source before installing so the builder only needs to snapshot
# the filesystem once after the install/build/prune sequence.
COPY . .

RUN npm install --include=dev --no-audit --no-fund \
	&& npm run build \
	&& npm prune --omit=dev \
	&& npm cache clean --force

ENV NODE_ENV=production

EXPOSE 8080

CMD ["node", "server.js"]
