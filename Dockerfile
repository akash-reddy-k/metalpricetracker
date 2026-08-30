FROM node:20-alpine
WORKDIR /app

# Install dependencies first (layer cached unless package*.json changes)
COPY package*.json ./
RUN npm ci --omit=dev

# Copy source
COPY entry.node.ts server.ts ./
COPY server/ ./server/

EXPOSE 3000
ENV PORT=3000

CMD ["npx", "tsx", "entry.node.ts"]
