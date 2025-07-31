FROM oven/bun:latest

WORKDIR /app

# Copy package files
COPY package.json bun.lock* ./

# Install dependencies (including dev dependencies for build)
RUN bun install

# Copy the application code
COPY . .

# Don't build webview in production - we'll run dev mode for debugging
# RUN bun run build:webview

# Expose the ports
EXPOSE 80
EXPOSE 5173