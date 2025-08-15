# Use official Node.js runtime as base image
FROM node:18-alpine

# Set the working directory inside the container
WORKDIR /app

# Copy package.json and package-lock.json (if available)
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy TypeScript configuration and source code
COPY tsconfig.json ./
COPY src/ ./src/

# Install development dependencies for building
RUN npm install --only=dev

# Build the TypeScript code
RUN npm run build

# Remove development dependencies to reduce image size
RUN npm prune --production

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S sukenyaa -u 1001

# Change ownership of the app directory to the nodejs user
RUN chown -R sukenyaa:nodejs /app
USER sukenyaa

# Expose the port the app runs on
EXPOSE 3000

# Define environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/ping || exit 1

# Start the application
CMD ["npm", "start"]