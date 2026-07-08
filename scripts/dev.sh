#!/usr/bin/env bash
# Start llm-proxy + backend for local development.
# Both auto-restart on crash; both stop together on Ctrl+C.
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PROXY_LOOP_PID=""
BACKEND_LOOP_PID=""

if [[ ! -f "$ROOT/llm-proxy/.env" ]]; then
  echo "Missing llm-proxy/.env — copy llm-proxy/.env.example and set CURSOR_API_KEY"
  exit 1
fi

if [[ ! -f "$ROOT/backend/.env" ]]; then
  echo "Missing backend/.env — copy backend/.env.example"
  exit 1
fi

export JAVA_HOME="${JAVA_HOME:-$(/usr/libexec/java_home 2>/dev/null || true)}"

stop_port() {
  local port=$1
  local pids
  pids=$(lsof -ti :"$port" 2>/dev/null || true)
  if [[ -n "$pids" ]]; then
    echo "Stopping stale process on :$port ($pids)..."
    kill $pids 2>/dev/null || true
    sleep 2
  fi
}

cleanup() {
  echo ""
  echo "Stopping services..."
  [[ -n "$PROXY_LOOP_PID" ]] && kill "$PROXY_LOOP_PID" 2>/dev/null || true
  [[ -n "$BACKEND_LOOP_PID" ]] && kill "$BACKEND_LOOP_PID" 2>/dev/null || true
  pkill -P "$PROXY_LOOP_PID" 2>/dev/null || true
  pkill -P "$BACKEND_LOOP_PID" 2>/dev/null || true
  stop_port 8081
  stop_port 8080
}
trap cleanup EXIT INT TERM

wait_for_proxy() {
  for _ in $(seq 1 90); do
    if curl -sf "http://localhost:8081/health" 2>/dev/null | grep -q '"status":"ok"'; then
      echo "LLM proxy is ready (agent pool warm)."
      return 0
    fi
    sleep 1
  done
  echo "LLM proxy failed to become ready at http://localhost:8081/health"
  return 1
}

wait_for_backend() {
  for _ in $(seq 1 120); do
    if curl -sf "http://localhost:8080/api/health" 2>/dev/null | grep -q '"status":"ok"'; then
      echo "Backend is ready."
      return 0
    fi
    sleep 1
  done
  echo "Backend failed to become ready at http://localhost:8080/api/health"
  return 1
}

echo "Clearing stale processes on :8080 and :8081..."
stop_port 8081
stop_port 8080

echo "Starting Cursor LLM proxy on :8081 (auto-restarts on crash)..."
(
  while true; do
    echo "[proxy] starting..."
    (cd "$ROOT/llm-proxy" && npm run start) || echo "[proxy] exited, restarting in 2s..."
    sleep 2
  done
) &
PROXY_LOOP_PID=$!

wait_for_proxy

echo "Starting Spring Boot backend on :8080 (auto-restarts on crash)..."
(
  while true; do
    echo "[backend] starting..."
    (
      set -a
      source "$ROOT/backend/.env"
      set +a
      cd "$ROOT/backend"
      mvn spring-boot:run
    ) || echo "[backend] exited, restarting in 3s..."
    sleep 3
  done
) &
BACKEND_LOOP_PID=$!

wait_for_backend

echo ""
echo "Dev stack running:"
echo "  LLM proxy  http://localhost:8081/health"
echo "  Backend    http://localhost:8080/api/health"
echo "  Frontend   cd frontend && npm run dev  (port 5173)"
echo ""
echo "Press Ctrl+C to stop proxy + backend."

wait
