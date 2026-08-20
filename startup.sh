#!/bin/sh
set -eu
# Resolve this script's directory so it works wherever the project lives.
cd "$(dirname "$(readlink -f "$0")")"
if curl -sf -o /dev/null --max-time 2 http://127.0.0.1:8080/; then
  exit 0
fi
npm run dev >>/tmp/app-startup.log 2>&1 &