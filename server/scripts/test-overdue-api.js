const jwt = require('jsonwebtoken');
const http = require('http');
const { JWT_SECRET } = require('../middleware/auth');

const token = jwt.sign(
  { id: 1, username: 'test', role: 'admin' },
  JWT_SECRET,
  { expiresIn: '1h' }
);

const opts = {
  hostname: '127.0.0.1',
  port: 5000,
  path: '/api/revenues/overdue-clients',
  method: 'GET',
  headers: { Authorization: `Bearer ${token}` },
};

http
  .get(opts, (res) => {
    let body = '';
    res.on('data', (c) => (body += c));
    res.on('end', () => {
      console.log('status', res.statusCode);
      try {
        const j = JSON.parse(body);
        console.log('type', Array.isArray(j) ? 'array' : typeof j);
        console.log('length', Array.isArray(j) ? j.length : JSON.stringify(j).slice(0, 200));
      } catch {
        console.log('body', body.slice(0, 300));
      }
    });
  })
  .on('error', (e) => console.error(e));
