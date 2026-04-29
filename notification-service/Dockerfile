# Stage 1: deps
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json .
RUN npm ci --only=production

# Stage 2: runtime
FROM node:20-alpine AS runtime
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
EXPOSE 8080
CMD ["node", "src/index.js"]
