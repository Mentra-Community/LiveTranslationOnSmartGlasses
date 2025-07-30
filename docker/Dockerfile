FROM oven/bun:latest

WORKDIR /app

# Copy package files
COPY package.json bun.lock* ./

# Install dependencies (including dev dependencies for build)
RUN bun install

# Copy the application code
COPY . .

# Install dependencies for the webview and build it
RUN cd webview && bun install && bun run build

# Expose the ports
EXPOSE 80
EXPOSE 4173