FROM node:18-bullseye-slim

# Use Debian-based image so Prisma can find a compatible OpenSSL implementation
WORKDIR /app

# Install system deps required by Prisma (OpenSSL etc.) and clean up
RUN apt-get update \
	&& apt-get install -y --no-install-recommends \
		ca-certificates \
		openssl \
		libssl1.1 \
	&& rm -rf /var/lib/apt/lists/*

# Install app dependencies (include prisma CLI in image)
COPY package.json package-lock.json* ./
RUN npm install --production=false || npm install

# Bundle app source
COPY . .

# Make entrypoint executable
RUN chmod +x /app/docker-entrypoint.sh || true

ENV NODE_ENV=production

ENTRYPOINT ["/bin/sh", "/app/docker-entrypoint.sh"]
