#!/bin/sh
set -e

echo "[엔트리포인트] Prisma 클라이언트 생성 중..."
npx prisma generate

echo "[엔트리포인트] 마이그레이션 적용 (prisma migrate deploy)..."
# 프로덕션 환경에서는 안전한 마이그레이션 배포를 사용합니다. DB가 준비될 때까지 대기 및 재시도
MAX_ATTEMPTS=30
SLEEP_SECONDS=2
attempt=1
while [ $attempt -le $MAX_ATTEMPTS ]; do
	echo "[엔트리포인트] prisma migrate deploy 시도 $attempt/$MAX_ATTEMPTS"
	if npx prisma migrate deploy; then
		echo "[엔트리포인트] prisma migrate deploy 성공"
		break
	else
		echo "[엔트리포인트] prisma migrate deploy 실패 (시도 $attempt)."
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
