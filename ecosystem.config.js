module.exports = {
  apps: [{
    name: 'website0721-backend',
    script: './server.js',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: '/var/www/website0721/logs/err.log',
    out_file: '/var/www/website0721/logs/out.log',
    log_file: '/var/www/website0721/logs/combined.log',
    time: true,
    cwd: '/var/www/website0721/backend'
  }]
};