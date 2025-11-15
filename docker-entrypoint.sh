#!/bin/sh
set -e

echo "[엔트리포인트] 이 메시지가 보인다면 최신 내용이 적용된 것입니다. 1"

echo "[엔트리포인트] Prisma 클라이언트 생성 중..."
npx prisma generate

echo "[엔트리포인트] 마이그레이션 적용 (prisma migrate deploy)..."
# 프로덕션 환경에서는 안전한 마이그레이션 배포를 사용합니다. DB가 준비될 때까지 대기 및 재시도
MAX_ATTEMPTS=30
SLEEP_SECONDS=2
attempt=1
MIGRATIONS_DIR="prisma/migrations"

# If migrations folder is missing or empty, create an initial migration folder using Prisma's CLI
if [ ! -d "$MIGRATIONS_DIR" ] || [ -z "$(ls -A $MIGRATIONS_DIR 2>/dev/null)" ]; then
	echo "[엔트리포인트] 마이그레이션 디렉터리가 비어있습니다. 초기 마이그레이션을 생성합니다."
	# Create a migration folder and SQL from empty -> current datamodel WITHOUT requiring DB connectivity
	TIMESTAMP=$(date -u +%Y%m%d%H%M%S)
	CREATED_MIGRATION="${TIMESTAMP}_init"
	mkdir -p "$MIGRATIONS_DIR/$CREATED_MIGRATION"

	# generate SQL script representing the schema; this does not need DB access
	if npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script > "$MIGRATIONS_DIR/$CREATED_MIGRATION/migration.sql" 2>/dev/null; then
		echo "[엔트리포인트] 초기 마이그레이션 SQL 생성됨: $CREATED_MIGRATION/migration.sql"
	else
		echo "[엔트리포인트] prisma migrate diff로 SQL 생성 실패 - migration.sql이 없다면 수동으로 확인하세요."
	fi
	# create a minimal migration.toml so Prisma recognizes the folder as a migration
	CREATED_AT=$(date -u +%Y-%m-%dT%H:%M:%SZ)
	cat > "$MIGRATIONS_DIR/$CREATED_MIGRATION/migration.toml" <<-TOML
[migration]
name = "$CREATED_MIGRATION"
created_at = "$CREATED_AT"
TOML
	echo "[엔트리포인트] 생성된 마이그레이션 폴더: $CREATED_MIGRATION"
fi
while [ $attempt -le $MAX_ATTEMPTS ]; do
	echo "[엔트리포인트] prisma migrate deploy 시도 $attempt/$MAX_ATTEMPTS"
	# capture output so we can inspect errors (e.g. P3005 when DB not empty)
	out=""
	if out=$(npx prisma migrate deploy 2>&1); then
		echo "[엔트리포인트] prisma migrate deploy 성공"
		break
	else
		echo "[엔트리포인트] prisma migrate deploy 실패 (시도 $attempt). 출력:"
		echo "$out"
		# If DB is not empty (P3005), but we generated a baseline migration, record it as applied.
		if echo "$out" | grep -q "P3005" || echo "$out" | grep -q "The database schema is not empty"; then
			# try to mark whatever migration we created as applied
			if [ -n "$CREATED_MIGRATION" ] && [ -d "$MIGRATIONS_DIR/$CREATED_MIGRATION" ]; then
				echo "[엔트리포인트] 기존 스키마가 존재합니다. 생성된 초기 마이그레이션($CREATED_MIGRATION)을 적용된 것으로 표시합니다 (baseline)."
				npx prisma migrate resolve --applied "$CREATED_MIGRATION" || true
				break
			fi
		fi
		echo "[엔트리포인트] prisma migrate deploy 실패(재시도 예정)."
		if [ $attempt -eq $MAX_ATTEMPTS ]; then
			echo "[엔트리포인트] 오류: prisma migrate deploy가 $MAX_ATTEMPTS회 실패했습니다."
			echo "[엔트리포인트] 가능한 원인:"
			echo "  - 데이터베이스 컨테이너가 아직 준비되지 않았습니다"
			echo "  - DATABASE_URL 또는 자격증명 오류"
			echo "  - 네트워크/컨테이너 간 연결 문제"
			echo "[엔트리포인트] 해결 방법: 데이터베이스 로그와 환경변수를 확인하세요."
			# 마지막 수단: migrate가 실패하면 안전하게 db push로 폴백할지 여부는 운영 정책에 따릅니다.
			echo "[엔트리포인트] 마이그레이션이 계속 실패하면 수동으로 마이그레이션을 점검하세요. 종료합니다."
			exit 1
		fi
		attempt=$((attempt+1))
		sleep $SLEEP_SECONDS
	fi
done

echo "[entrypoint] Starting app..."
node src/index.js
