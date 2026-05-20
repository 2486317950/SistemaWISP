const jwt = require('jsonwebtoken');
const http = require('http');
const { JWT_SECRET } = require('../middleware/auth');

const token = jwt.sign({ id: 1, username: 'a', role: 'admin' }, JWT_SECRET, { expiresIn: '1h' });

function get(path) {
  return new Promise((resolve) => {
    http
      .get(
        { hostname: '127.0.0.1', port: 5000, path, headers: { Authorization: `Bearer ${token}` } },
        (res) => {
          let body = '';
          res.on('data', (c) => (body += c));
          res.on('end', () => resolve({ status: res.statusCode, body: body.slice(0, 150) }));
        }
      )
      .on('error', (e) => resolve({ status: 0, body: String(e) }));
  });
}

(async () => {
  for (const p of [
    '/api/clients/unpaid-this-month',
    '/api/clients/stats',
  ]) {
    const x = await get(p);
    console.log(p, x.status, x.body);
  }
})();
