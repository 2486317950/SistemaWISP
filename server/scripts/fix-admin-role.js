const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'database.sqlite');

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Error al conectar con la base de datos:', err);
    process.exit(1);
  }
  console.log('Conectado a la base de datos');
});

// Actualizar el rol del usuario admin
db.run('UPDATE users SET role = ? WHERE username = ?', ['admin', 'admin'], function(err) {
  if (err) {
    console.error('Error al actualizar el rol:', err);
  } else {
    if (this.changes > 0) {
      console.log(`Rol del usuario admin actualizado. Filas afectadas: ${this.changes}`);
    } else {
      console.log('No se encontró el usuario admin o ya tiene el rol correcto');
    }
  }
  
  // Verificar el rol actual
  db.get('SELECT username, role FROM users WHERE username = ?', ['admin'], (err, row) => {
    if (err) {
      console.error('Error al verificar el rol:', err);
    } else if (row) {
      console.log(`Usuario: ${row.username}, Rol: ${row.role}`);
    } else {
      console.log('Usuario admin no encontrado');
    }
    
    db.close((err) => {
      if (err) {
        console.error('Error al cerrar la base de datos:', err);
      } else {
        console.log('Base de datos cerrada');
      }
      process.exit(0);
    });
  });
});



