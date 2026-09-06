module.exports = {
  apps: [{
    name: 'scraper-hub',
    script: 'server.js',
    instances: 1,
    exec_mode: 'fork',
    watch: false,
    max_memory_restart: '800M',
    min_uptime: '10s',
    max_restarts: 10,
    restart_delay: 3000,
    kill_timeout: 5000,
    wait_ready: false,
    autorestart: true,
    env: {
      NODE_ENV: 'production',
      PORT: '3000',
      SCRAPE_CONCURRENCY: '4',
    },
    error_file: './logs/scraper-hub-error.log',
    out_file: './logs/scraper-hub-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
  }]
};
