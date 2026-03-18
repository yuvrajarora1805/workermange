# Use official Node.js image as build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy source code
COPY . .

# Build Next.js app
RUN npm run build

# Use official Node.js image as runner stage
FROM node:20-alpine AS runner

WORKDIR /app

# Copy necessary files from builder
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules ./node_modules

# Set environment variables
ENV NODE_ENV=production

# Expose port
EXPOSE 3000

# Start the application
CMD ["npm", "start"]
