FROM node:22-alpine

WORKDIR /app

COPY wisp-service/package.json ./package.json
RUN npm install --omit=dev --no-audit --no-fund

COPY wisp-service/server.js ./server.js

ENV NODE_ENV=production

EXPOSE 8080

CMD ["node", "server.js"]
