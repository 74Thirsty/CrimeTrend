const { stdout } = process;

function formatLevel(level) {
  return level.toUpperCase().padEnd(5, ' ');
}

class Logger {
  info(message, meta = {}) {
    this.log('info', message, meta);
  }

  warn(message, meta = {}) {
    this.log('warn', message, meta);
  }

  error(message, meta = {}) {
    this.log('error', message, meta);
  }

  log(level, message, meta) {
    const timestamp = new Date().toISOString();
    const payload = { level, message, ...meta };
    stdout.write(`[${timestamp}] ${formatLevel(level)} ${JSON.stringify(payload)}\n`);
  }
}

module.exports = new Logger();
