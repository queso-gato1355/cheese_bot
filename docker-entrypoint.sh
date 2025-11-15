#!/bin/sh
set -e

echo "[entrypoint] Generating Prisma client..."
npx prisma generate

echo "[entrypoint] Applying schema to database (prisma db push)..."
# Use db push to ensure schema exists; wait & retry until DB is ready
MAX_ATTEMPTS=30
SLEEP_SECONDS=2
attempt=1
while [ $attempt -le $MAX_ATTEMPTS ]; do
	echo "[entrypoint] prisma db push attempt $attempt/$MAX_ATTEMPTS"
	if npx prisma db push; then
		echo "[entrypoint] prisma db push succeeded"
		break
	else
		echo "[entrypoint] prisma db push failed (attempt $attempt)."
		# If it's the last attempt, fail with helpful message
		if [ $attempt -eq $MAX_ATTEMPTS ]; then
			echo "[entrypoint] ERROR: prisma db push failed after $MAX_ATTEMPTS attempts."
			echo "[entrypoint] Possible causes:"
			echo "  - Database container not ready yet"
			echo "  - Incorrect DATABASE_URL / credentials"
			echo "  - Network/connectivity issue between containers"
			echo "[entrypoint] Inspect database container logs and environment variables. Exiting."
			exit 1
		fi
		attempt=$((attempt+1))
		sleep $SLEEP_SECONDS
	fi
done

echo "[entrypoint] Starting app..."
node src/index.js
