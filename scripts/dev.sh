#!/usr/bin/env bash
# Start llm-proxy + backend + frontend for local development.
# All three auto-restart on crash; all stop together on Ctrl+C.
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PROXY_LOOP_PID=""
BACKEND_LOOP_PID=""
FRONTEND_LOOP_PID=""

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
    pids=$(lsof -ti :"$port" 2>/dev/null || true)
    if [[ -n "$pids" ]]; then
      kill -9 $pids 2>/dev/null || true
      sleep 1
    fi
  fi
}

clear_h2_lock() {
  rm -f "$ROOT/backend/data/itinerate.lock.db" 2>/dev/null || true
}

cleanup() {
  echo ""
  echo "Stopping services..."
  [[ -n "$PROXY_LOOP_PID" ]] && kill "$PROXY_LOOP_PID" 2>/dev/null || true
  [[ -n "$BACKEND_LOOP_PID" ]] && kill "$BACKEND_LOOP_PID" 2>/dev/null || true
  [[ -n "$FRONTEND_LOOP_PID" ]] && kill "$FRONTEND_LOOP_PID" 2>/dev/null || true
  pkill -P "$PROXY_LOOP_PID" 2>/dev/null || true
  pkill -P "$BACKEND_LOOP_PID" 2>/dev/null || true
  pkill -P "$FRONTEND_LOOP_PID" 2>/dev/null || true
  stop_port 8081
  stop_port 8080
  stop_port 5173
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

wait_for_frontend() {
  for _ in $(seq 1 60); do
    if curl -sf "http://localhost:5173/" 2>/dev/null | grep -qi "<!doctype html>"; then
      echo "Frontend is ready."
      return 0
    fi
    sleep 1
  done
  echo "Frontend failed to become ready at http://localhost:5173"
  return 1
}

echo "Clearing stale processes on :8080, :8081, and :5173..."
stop_port 8081
stop_port 8080
stop_port 5173
clear_h2_lock

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
    stop_port 8080
    clear_h2_lock
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

echo "Starting Vite frontend on :5173 (auto-restarts on crash)..."
(
  while true; do
    echo "[frontend] starting..."
    stop_port 5173
    (cd "$ROOT/frontend" && npm run dev) || echo "[frontend] exited, restarting in 2s..."
    sleep 2
  done
) &
FRONTEND_LOOP_PID=$!

wait_for_frontend

echo ""
echo "Dev stack running:"
echo "  App        http://localhost:5173"
echo "  LLM proxy  http://localhost:8081/health"
echo "  Backend    http://localhost:8080/api/health"
echo ""
echo "Press Ctrl+C to stop proxy, backend, and frontend."

wait
