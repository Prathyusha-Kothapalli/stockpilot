# StockPilot Enterprise ERP - Docker Image Definition
FROM node:18-alpine

# Install Python 3.10 and SQLite build dependencies
RUN apk add --no-gradient --no-cache python3 py3-pip make g++ sqlite

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install Node dependencies
RUN npm ci --only=production

# Copy application source code
COPY . .

# Environment variables
ENV PORT=3000
ENV NODE_ENV=production

# Expose server port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

# Start StockPilot ERP server
CMD ["node", "server.js"]
