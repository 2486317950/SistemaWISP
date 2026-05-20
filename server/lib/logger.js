/**
 * Logger simple: consola + archivo (opcional) para errores y eventos importantes.
 */
const fs = require('fs');
const path = require('path');

const LOG_DIR = path.join(__dirname, '..', 'logs');
const LOG_FILE = path.join(LOG_DIR, 'app.log');
const MAX_LOG_SIZE = 5 * 1024 * 1024; // 5 MB
const ROTATE_AFTER = 3; // rotar cuando hay 3 archivos .log.*

function ensureLogDir() {
  try {
    if (!fs.existsSync(LOG_DIR)) {
      fs.mkdirSync(LOG_DIR, { recursive: true });
    }
  } catch (_) {}
}

function getLogPath() {
  ensureLogDir();
  return LOG_FILE;
}

function write(level, ...args) {
  const line = `${new Date().toISOString()} [${level}] ${args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ')}\n`;
  try {
    const p = getLogPath();
    fs.appendFileSync(p, line);
    if (fs.existsSync(p) && fs.statSync(p).size > MAX_LOG_SIZE) {
      const rotated = p + '.' + Date.now();
      fs.renameSync(p, rotated);
      const files = fs.readdirSync(LOG_DIR).filter((f) => f.startsWith('app.log.')).sort();
      while (files.length > ROTATE_AFTER) {
        try {
          fs.unlinkSync(path.join(LOG_DIR, files.shift()));
        } catch (_) {}
      }
    }
  } catch (_) {}
}

const logger = {
  info(...args) {
    console.log(...args);
    write('INFO', ...args);
  },
  warn(...args) {
    console.warn(...args);
    write('WARN', ...args);
  },
  error(...args) {
    console.error(...args);
    write('ERROR', ...args);
  }
};

module.exports = logger;
