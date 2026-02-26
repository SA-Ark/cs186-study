FROM node:22-alpine

# Add curl for Coolify health checks
RUN apk add --no-cache curl

WORKDIR /app

# Create writable credentials directory (for OAuth token persistence)
RUN mkdir -p /app/.credentials && chown -R node:node /app/.credentials

COPY server.js .
COPY docs/ public/

# Use writable path for credentials inside container
ENV CLAUDE_CREDENTIALS_PATH=/app/.credentials/credentials.json

EXPOSE 3000

# Run as non-root
USER node

CMD ["node", "server.js"]
