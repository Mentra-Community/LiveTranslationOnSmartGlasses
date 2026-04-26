# Architecture

Developer reference for the Live Translation app — Docker workflow and development setup.

---

## Development

### Prerequisites

- [Docker](https://www.docker.com/products/docker-desktop)
- [Bun](https://bun.sh/) (optional for local development)

### Docker Development (Recommended)

The quickest way to get started is using Docker:

```bash
# Start the development environment
bun run docker:dev

# Start in detached mode
bun run docker:dev:detach

# View logs
bun run logs

# Stop the container
bun run docker:stop

# Rebuild the container
bun run docker:build
```
