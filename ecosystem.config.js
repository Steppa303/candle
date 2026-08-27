module.exports = {
  apps: [{
    name: 'candle',
    script: 'server/index.js',
    cwd: '/root/.local/.openclaw/workspace/projects/candle',
    env: {
      NODE_ENV: 'production',
      PORT: 3011
    },
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '256M',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
  }]
};
