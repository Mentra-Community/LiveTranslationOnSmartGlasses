FROM oven/bun:latest

WORKDIR /app

# Copy package files
COPY package.json bun.lock* ./

# Install dependencies (including dev dependencies for build)
RUN bun install

# Copy the application code
COPY . .

# Install webview dependencies (but don't build - we'll run dev mode for debugging)
RUN cd webview && bun install

# Expose the ports
EXPOSE 80
EXPOSE 5173