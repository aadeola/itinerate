#!/usr/bin/env bash
set -euo pipefail

check_get() {
  local name=$1
  local url=$2
  if response=$(curl -sf "$url" 2>/dev/null); then
    echo "OK   $name  $url"
    echo "     $response"
  else
    echo "DOWN $name  $url"
  fi
}

echo "Itinerate service status"
echo "========================"
check_get "llm-proxy" "http://localhost:8081/health"
check_get "backend"   "http://localhost:8080/api/health"

if curl -sf "http://localhost:5173/" -o /dev/null 2>/dev/null; then
  echo "OK   frontend http://localhost:5173"
else
  echo "DOWN frontend http://localhost:5173"
fi
