const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, '..', 'database.db');
if (!fs.existsSync(dbPath)) {
  console.log('database.db no existe');
  process.exit(0);
}
const db = new sqlite3.Database(dbPath);
db.all("SELECT name FROM sqlite_master WHERE type='table'", [], (e, rows) => {
  if (e) { console.error(e); db.close(); return; }
  console.log('Tablas en database.db:', (rows || []).map(r => r.name).join(', '));
  if ((rows || []).some(r => r.name === 'clients')) {
    db.all('SELECT id, client_number, name FROM clients ORDER BY id', [], (e2, clients) => {
      console.log('Clientes:', (clients || []).length);
      (clients || []).forEach(c => console.log('  ', c.id, c.client_number, c.name));
      db.close();
    });
  } else db.close();
});
