/**
 * Script para restablecer la contraseña del usuario admin
 * Uso: node server/scripts/reset-admin-password.js [username] [newPassword]
 * Ejemplo: node server/scripts/reset-admin-password.js admin admin123
 */

const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

// Obtener argumentos de la línea de comandos
const username = process.argv[2] || 'admin';
const newPassword = process.argv[3] || 'admin123';

// Ruta a la base de datos
const dbPath = path.join(__dirname, '..', 'database.sqlite');

console.log('🔧 Script de restablecimiento de contraseña');
console.log('==========================================');
console.log(`Usuario: ${username}`);
console.log(`Nueva contraseña: ${newPassword}`);
console.log(`Ruta de BD: ${dbPath}`);
console.log('');

// Verificar que la base de datos existe
if (!fs.existsSync(dbPath)) {
  console.error('❌ Error: La base de datos no existe en:', dbPath);
  process.exit(1);
}

// Conectar a la base de datos
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Error al conectar a la base de datos:', err.message);
    process.exit(1);
  }
  console.log('✅ Conectado a la base de datos');
});

// Buscar el usuario
db.get('SELECT * FROM users WHERE username = ?', [username], async (err, user) => {
  if (err) {
    console.error('❌ Error al buscar usuario:', err.message);
    db.close();
    process.exit(1);
  }

  if (!user) {
    console.error(`❌ Error: Usuario "${username}" no encontrado`);
    
    // Listar usuarios disponibles
    db.all('SELECT id, username, role FROM users', (err, users) => {
      if (!err && users && users.length > 0) {
        console.log('\n📋 Usuarios disponibles:');
        users.forEach(u => {
          console.log(`   - ID: ${u.id}, Username: ${u.username}, Rol: ${u.role}`);
        });
      } else {
        console.log('   No hay usuarios en la base de datos');
      }
      db.close();
      process.exit(1);
    });
    return;
  }

  console.log(`✅ Usuario encontrado: ${user.username} (ID: ${user.id}, Rol: ${user.role})`);
  console.log(`   Hash actual: ${user.password ? user.password.substring(0, 30) + '...' : 'NULL'}`);

  try {
    // Hashear la nueva contraseña
    console.log('\n🔐 Generando nuevo hash...');
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    console.log(`   Nuevo hash: ${hashedPassword.substring(0, 30)}...`);

    // Actualizar la contraseña
    db.run('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, user.id], (err) => {
      if (err) {
        console.error('❌ Error al actualizar contraseña:', err.message);
        db.close();
        process.exit(1);
      }

      console.log('\n✅ Contraseña restablecida exitosamente!');
      console.log(`   Usuario: ${user.username}`);
      console.log(`   Nueva contraseña: ${newPassword}`);
      console.log('\n💡 Ahora puedes iniciar sesión con estas credenciales.');
      
      db.close();
      process.exit(0);
    });
  } catch (hashError) {
    console.error('❌ Error al hashear contraseña:', hashError.message);
    db.close();
    process.exit(1);
  }
});

