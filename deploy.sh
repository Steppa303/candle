#!/bin/bash
# Deploy script for Candle
# Builds frontend and copies to Caddy-served directory

set -e

PROJECT_DIR="/root/.local/.openclaw/workspace/projects/candle"
DEPLOY_DIR="/var/www/apps/candle"

echo "🕯️ Building Candle frontend..."
cd "$PROJECT_DIR/client"
npm run build

echo "📦 Deploying to $DEPLOY_DIR..."
rm -rf "$DEPLOY_DIR"
mkdir -p "$DEPLOY_DIR"
cp -r dist/* "$DEPLOY_DIR/"
chown -R caddy:caddy "$DEPLOY_DIR"

echo "🔄 Reloading Caddy..."
systemctl reload caddy

echo "✅ Candle deployed! https://candle.steppa.online"
