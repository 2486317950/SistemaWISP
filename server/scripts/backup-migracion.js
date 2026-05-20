/**
 * Copia de seguridad completa para migración a servidor dedicado.
 * Incluye: base de datos SQLite, archivo .env y README de restauración.
 *
 * Uso: node scripts/backup-migracion.js
 * Ejecutar desde la carpeta server: node scripts/backup-migracion.js
 */

const fs = require('fs');
const path = require('path');

const SERVER_DIR = path.join(__dirname, '..');
const BACKUPS_DIR = path.join(SERVER_DIR, 'backups');
const DB_PATH = path.join(SERVER_DIR, 'database.sqlite');
const ENV_PATH = path.join(SERVER_DIR, '.env');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function getTimestamp() {
  const now = new Date();
  return now.toISOString().replace(/T/, '_').replace(/:/g, '-').replace(/\..+/, '');
}

function copyFile(src, dest) {
  if (!fs.existsSync(src)) {
    console.warn('  ⚠ No encontrado:', src);
    return false;
  }
  fs.copyFileSync(src, dest);
  console.log('  ✓ Copiado:', path.basename(src));
  return true;
}

function writeReadme(dir, timestamp) {
  const readme = `COPIA DE SEGURIDAD - MIGRACIÓN
===============================
Fecha: ${timestamp.replace(/_/g, ' ')}

CONTENIDO
---------
- database.sqlite  : Base de datos completa (clientes, pagos, instalaciones, portal, etc.)
- .env             : Variables de entorno (revisar y ajustar en el nuevo servidor)

RESTAURACIÓN EN EL NUEVO SERVIDOR
---------------------------------
1. Instalar Node.js y dependencias del proyecto (npm install en /server).
2. Copiar database.sqlite a la carpeta /server del nuevo servidor
   (reemplazar el archivo si existe).
3. Copiar .env a /server y revisar/ajustar:
   - PORT, NODE_ENV
   - JWT_SECRET (recomendado generar uno nuevo y actualizar solo si es necesario)
   - Cualquier URL o credencial específica del nuevo servidor
4. Reiniciar el servicio (pm2, systemd, etc.).

NOTA: La base de datos incluye todos los datos: usuarios, clientes, pagos,
comprobantes (archivos en BLOB), chats del portal, configuración, etc.
`;
  const readmePath = path.join(dir, 'BACKUP_README.txt');
  fs.writeFileSync(readmePath, readme, 'utf8');
  console.log('  ✓ Creado: BACKUP_README.txt');
}

function main() {
  const timestamp = getTimestamp();
  const backupName = `backup_migracion_${timestamp}`;
  const backupDir = path.join(BACKUPS_DIR, backupName);

  console.log('\n=== Copia de seguridad para migración ===\n');
  console.log('Carpeta de destino:', backupDir);

  ensureDir(BACKUPS_DIR);
  ensureDir(backupDir);

  // 1. Base de datos
  console.log('\n[1] Base de datos (database.sqlite)');
  if (!copyFile(DB_PATH, path.join(backupDir, 'database.sqlite'))) {
    console.error('  ERROR: No se encontró database.sqlite. ¿El servidor ha estado en ejecución?');
    process.exitCode = 1;
  }

  // 2. Variables de entorno
  console.log('\n[2] Variables de entorno (.env)');
  if (!copyFile(ENV_PATH, path.join(backupDir, '.env'))) {
    console.warn('  (Opcional: crea .env en el nuevo servidor según documentación)');
  }

  // 3. README de restauración
  console.log('\n[3] Instrucciones de restauración');
  writeReadme(backupDir, timestamp);

  console.log('\n=== Backup completado ===');
  console.log('Ubicación:', backupDir);
  console.log('\nRecomendación: copia esta carpeta al nuevo servidor (USB, SCP, etc.)');
  console.log('y luego restaura según BACKUP_README.txt\n');
}

main();
