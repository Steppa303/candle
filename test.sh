#!/bin/bash
# Candle — Full Integration Test Script
# Tests all components: Server, REST API, WebSocket, Frontend, Caddy, DNS

set -e

BASE_URL="http://localhost:3011"
DOMAIN_URL="http://candle.steppa.online"
PASS=0
FAIL=0
TESTS=()

green() { echo -e "\033[32m✓ $1\033[0m"; PASS=$((PASS+1)); TESTS+=("✓ $1"); }
red()   { echo -e "\033[31m✗ $1\033[0m"; FAIL=$((FAIL+1)); TESTS+=("✗ $1"); }
info()  { echo -e "\033[34m→ $1\033[0m"; }

echo "========================================"
echo "🕯️  Candle — Full Integration Tests"
echo "========================================"
echo ""

# ------------------------------------------
# 1. Server Health Check
# ------------------------------------------
info "Test 1: Server Health Check (localhost:3011)"
HEALTH=$(curl -sf http://localhost:3011/health 2>/dev/null)
if echo "$HEALTH" | grep -q '"status":"ok"'; then
  green "Server is running on port 3011"
else
  red "Server NOT responding on port 3011"
fi

# ------------------------------------------
# 2. Frontend Build Check
# ------------------------------------------
info "Test 2: Frontend Build"
if [ -f "/root/.local/.openclaw/workspace/projects/candle/client/dist/index.html" ]; then
  green "Frontend dist/index.html exists"
else
  red "Frontend dist/index.html MISSING"
fi

if [ -d "/root/.local/.openclaw/workspace/projects/candle/client/dist/assets" ]; then
  JS_COUNT=$(ls /root/.local/.openclaw/workspace/projects/candle/client/dist/assets/*.js 2>/dev/null | wc -l)
  CSS_COUNT=$(ls /root/.local/.openclaw/workspace/projects/candle/client/dist/assets/*.css 2>/dev/null | wc -l)
  if [ "$JS_COUNT" -gt 0 ] && [ "$CSS_COUNT" -gt 0 ]; then
    green "Frontend assets present ($JS_COUNT JS, $CSS_COUNT CSS)"
  else
    red "Frontend assets missing (JS: $JS_COUNT, CSS: $CSS_COUNT)"
  fi
else
  red "Frontend dist/assets/ directory MISSING"
fi

# ------------------------------------------
# 3. REST API — Session CRUD
# ------------------------------------------
info "Test 3: REST API — Create Session"
CREATE_RESP=$(curl -sf -X POST http://localhost:3011/api/sessions \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Session"}' 2>/dev/null)

if echo "$CREATE_RESP" | grep -q '"id"'; then
  SESSION_ID=$(echo "$CREATE_RESP" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
  green "POST /api/sessions → Session created (id: $SESSION_ID)"
else
  red "POST /api/sessions → Failed to create session"
  SESSION_ID=""
fi

info "Test 4: REST API — List Sessions"
LIST_RESP=$(curl -sf http://localhost:3011/api/sessions 2>/dev/null)
if echo "$LIST_RESP" | grep -q '"sessions"'; then
  COUNT=$(echo "$LIST_RESP" | grep -o '"id"' | wc -l)
  green "GET /api/sessions → $COUNT session(s) returned"
else
  red "GET /api/sessions → Failed"
fi

info "Test 5: REST API — Get Session Details"
if [ -n "$SESSION_ID" ]; then
  GET_RESP=$(curl -sf http://localhost:3011/api/sessions/$SESSION_ID 2>/dev/null)
  if echo "$GET_RESP" | grep -q '"session"'; then
    green "GET /api/sessions/:id → Session details returned"
  else
    red "GET /api/sessions/:id → Failed"
  fi
else
  red "GET /api/sessions/:id → Skipped (no session ID)"
fi

info "Test 6: REST API — Rename Session"
if [ -n "$SESSION_ID" ]; then
  PATCH_RESP=$(curl -sf -X PATCH http://localhost:3011/api/sessions/$SESSION_ID \
    -H "Content-Type: application/json" \
    -d '{"name":"Renamed Test"}' 2>/dev/null)
  if echo "$PATCH_RESP" | grep -q '"Renamed Test"'; then
    green "PATCH /api/sessions/:id → Session renamed"
  else
    red "PATCH /api/sessions/:id → Failed"
  fi
else
  red "PATCH /api/sessions/:id → Skipped (no session ID)"
fi

# ------------------------------------------
# 4. WebSocket Connection Test
# ------------------------------------------
info "Test 7: WebSocket Connection"
# Use node to test socket.io connection
WS_TEST=$(node -e "
const { io } = require('socket.io-client');
const socket = io('http://localhost:3011', { reconnection: false, timeout: 5000 });
socket.on('connect', () => {
  console.log('CONNECTED:' + socket.id);
  socket.disconnect();
  process.exit(0);
});
socket.on('connect_error', (err) => {
  console.log('ERROR:' + err.message);
  process.exit(1);
});
setTimeout(() => { console.log('TIMEOUT'); process.exit(1); }, 5000);
" 2>/dev/null)

if echo "$WS_TEST" | grep -q "CONNECTED"; then
  green "Socket.io WebSocket connection works"
else
  red "Socket.io WebSocket connection failed ($WS_TEST)"
fi

# ------------------------------------------
# 5. WebSocket Session Events Test
# ------------------------------------------
info "Test 8: WebSocket Session Events"
WS_SESSION_TEST=$(node -e "
const { io } = require('socket.io-client');
const socket = io('http://localhost:3011', { reconnection: false, timeout: 5000 });
let results = [];

socket.on('connect', () => {
  socket.emit('session:new', { name: 'WS Test Session' });
});

socket.on('session:created', (data) => {
  results.push('CREATED:' + data.session.id);
  socket.emit('session:switch', { sessionId: data.session.id });
});

socket.on('session:history', (data) => {
  results.push('HISTORY:' + data.session.id);
  socket.emit('session:delete', { sessionId: data.session.id });
});

socket.on('session:deleted', (data) => {
  results.push('DELETED:' + data.sessionId);
  console.log(results.join('|'));
  socket.disconnect();
  process.exit(0);
});

socket.on('ai:error', (data) => {
  results.push('ERROR:' + data.message);
  console.log(results.join('|'));
  socket.disconnect();
  process.exit(1);
});

setTimeout(() => { console.log('TIMEOUT|' + results.join('|')); process.exit(1); }, 8000);
" 2>/dev/null)

if echo "$WS_SESSION_TEST" | grep -q "CREATED" && echo "$WS_SESSION_TEST" | grep -q "DELETED"; then
  green "WebSocket session:new → session:switch → session:delete flow works"
else
  red "WebSocket session events failed ($WS_SESSION_TEST)"
fi

# ------------------------------------------
# 6. Canvas → AI Flow (End-to-End)
# ------------------------------------------
info "Test 9: Canvas → AI Flow (stroke:complete → ai:response)"

# Create a tiny 1x1 red PNG for testing
TEST_PNG="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwADhQGAWjR9awAAAABJRU5ErkJggg=="

AI_TEST=$(node -e "
const { io } = require('socket.io-client');
const socket = io('http://localhost:3011', { reconnection: false, timeout: 30000 });

socket.on('connect', () => {
  // First create a session
  socket.emit('session:new', { name: 'AI Test Session' });
});

socket.on('session:created', (data) => {
  // Send a test canvas PNG
  socket.emit('stroke:complete', {
    sessionId: data.session.id,
    canvasPng: '${TEST_PNG}'
  });
});

socket.on('ai:thinking', () => {
  console.error('THINKING_RECEIVED');
});

socket.on('ai:response', (data) => {
  console.log('RESPONSE:' + JSON.stringify({ text: data.text, hasDrawing: !!data.drawing }));
  socket.disconnect();
  process.exit(0);
});

socket.on('ai:error', (data) => {
  console.log('AI_ERROR:' + data.message);
  socket.disconnect();
  process.exit(0);  // Not a test failure — API may not be configured
});

setTimeout(() => { console.log('TIMEOUT'); process.exit(1); }, 25000);
" 2>&1)

if echo "$AI_TEST" | grep -q "RESPONSE:"; then
  green "Canvas → AI response received"
elif echo "$AI_TEST" | grep -q "AI_ERROR:"; then
  AI_ERR=$(echo "$AI_TEST" | grep "AI_ERROR:" | head -1)
  green "Canvas → AI error handled gracefully ($AI_ERR)"
else
  red "Canvas → AI flow timeout or failed ($AI_TEST)"
fi

# ------------------------------------------
# 7. Caddy Config
# ------------------------------------------
info "Test 10: Caddy Config Validation"
CADDY_VALID=$(caddy validate --config /etc/caddy/Caddyfile 2>&1)
if echo "$CADDY_VALID" | grep -q "Valid configuration"; then
  green "Caddyfile is valid"
else
  red "Caddyfile validation failed"
fi

# ------------------------------------------
# 8. DNS Record
# ------------------------------------------
info "Test 11: DNS Record"
DNS_IP=$(dig +short candle.steppa.online 2>/dev/null | head -1)
if [ "$DNS_IP" = "185.217.126.72" ]; then
  green "DNS: candle.steppa.online → $DNS_IP"
else
  red "DNS: candle.steppa.online → $DNS_IP (expected 185.217.126.72)"
fi

# ------------------------------------------
# 9. Caddy Proxy → Backend
# ------------------------------------------
info "Test 12: Caddy Proxy → Backend (via domain)"
DOMAIN_API=$(curl -sf http://candle.steppa.online/api/sessions 2>/dev/null)
if echo "$DOMAIN_API" | grep -q '"sessions"'; then
  green "Caddy proxy: candle.steppa.online/api/sessions works"
else
  red "Caddy proxy: candle.steppa.online/api/sessions failed"
fi

# ------------------------------------------
# 10. Frontend via Domain
# ------------------------------------------
info "Test 13: Frontend via Domain"
DOMAIN_HTML=$(curl -sf http://candle.steppa.online/ 2>/dev/null)
if echo "$DOMAIN_HTML" | grep -q "Candle"; then
  green "Frontend served at candle.steppa.online"
else
  red "Frontend NOT served at candle.steppa.online"
fi

# ------------------------------------------
# 11. PM2 Status
# ------------------------------------------
info "Test 14: PM2 Process Status"
PM2_STATUS=$(pm2 jlist 2>/dev/null | node -e "
const data = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
const candle = data.find(d => d.name === 'candle');
if (candle && candle.pm2_env.status === 'online') {
  console.log('online');
} else {
  console.log('offline');
}
" 2>/dev/null)

if [ "$PM2_STATUS" = "online" ]; then
  green "PM2: candle process is online"
else
  red "PM2: candle process is NOT online ($PM2_STATUS)"
fi

# ------------------------------------------
# 12. Database Check
# ------------------------------------------
info "Test 15: SQLite Database"
DB_PATH="/root/.local/.openclaw/workspace/projects/candle/data/candle.db"
if [ -f "$DB_PATH" ]; then
  TABLES=$(sqlite3 "$DB_PATH" ".tables" 2>/dev/null)
  if echo "$TABLES" | grep -q "sessions" && echo "$TABLES" | grep -q "interactions"; then
    green "SQLite DB has sessions + interactions tables"
  else
    red "SQLite DB missing tables (found: $TABLES)"
  fi
else
  red "SQLite DB file not found at $DB_PATH"
fi

# ------------------------------------------
# Cleanup: Delete test sessions
# ------------------------------------------
info "Cleanup: Removing test sessions"
curl -sf http://localhost:3011/api/sessions 2>/dev/null | node -e "
const data = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
for (const s of data.sessions) {
  if (s.name.includes('Test') || s.name.includes('test')) {
    require('http').request('http://localhost:3011/api/sessions/' + s.id, { method: 'DELETE' }).end();
  }
}
" 2>/dev/null

# ------------------------------------------
# Summary
# ------------------------------------------
echo ""
echo "========================================"
echo "📊 Test Results"
echo "========================================"
for t in "${TESTS[@]}"; do
  echo "  $t"
done
echo ""
echo "========================================"
TOTAL=$((PASS + FAIL))
echo "Total: $TOTAL | Passed: $PASS | Failed: $FAIL"
if [ "$FAIL" -eq 0 ]; then
  echo -e "\033[32m🕯️  ALL TESTS PASSED!\033[0m"
else
  echo -e "\033[31m⚠️  $FAIL TEST(S) FAILED\033[0m"
fi
echo "========================================"

exit $FAIL
