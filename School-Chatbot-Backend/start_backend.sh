#!/usr/bin/env bash
set -euo pipefail

PORT="${PORT:-8000}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PYTHON="$ROOT/venv/Scripts/python.exe"

if [[ ! -x "$PYTHON" ]]; then
  echo "venv Python을 찾을 수 없습니다: $PYTHON" >&2
  exit 1
fi

PID="$(netstat -ano 2>/dev/null | awk -v port=":$PORT" '$2 ~ port && $4 == "LISTENING" {print $5; exit}')"
if [[ -n "${PID:-}" ]]; then
  echo "기존 $PORT 포트 프로세스 종료: $PID"
  taskkill //PID "$PID" //F >/dev/null
fi

cd "$ROOT"
echo "백엔드 시작: http://0.0.0.0:$PORT"
exec "$PYTHON" -m uvicorn main:app --host 0.0.0.0 --port "$PORT"
