FROM node:22-alpine AS pyodide

WORKDIR /app/my-app
COPY my-app/package*.json ./
RUN npm ci --omit=dev

FROM node:22-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY --from=pyodide /app/my-app/node_modules/pyodide ./my-app/node_modules/pyodide
COPY .sequelizerc ./
COPY auth.js server.js ./
COPY config ./config
COPY migrations ./migrations
COPY models ./models
COPY routes ./routes
COPY services ./services

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:3000/health').then((response) => process.exit(response.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["sh", "-c", "npx sequelize-cli db:migrate && node server.js"]
