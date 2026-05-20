/**
 * Crea una carpeta con todo el proyecto SIN archivos que se pueden volver a descargar:
 * node_modules, .git, .gradle, build, dist, backups, uploads, etc.
 *
 * Uso: node scripts/crear-carpeta-sin-dependencias.js
 * Ejecutar desde la raíz del proyecto: node scripts/crear-carpeta-sin-dependencias.js
 */

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.join(__dirname, '..');
const OUT_FOLDER = path.join(PROJECT_ROOT, 'SistemaWISP_sin_dependencias');

const EXCLUDE_PATTERNS = [
  /[/\\]node_modules[/\\]|^node_modules[/\\]/,
  /[/\\]\.git[/\\]|^\.git[/\\]/,
  /[/\\]client[/\\]dist[/\\]/,
  /[/\\]client[/\\]build[/\\]/,
  /[/\\]server[/\\]backups[/\\]/,
  /[/\\]server[/\\]uploads[/\\]/,
  /[/\\]\.vscode[/\\]/,
  /[/\\]\.idea[/\\]/,
  /[/\\]coverage[/\\]/,
  /[/\\]\.nyc_output[/\\]/,
  /[/\\]\.gradle[/\\]|^\.gradle[/\\]/,
  /[/\\]build[/\\]$|[/\\]build[/\\]/,
  /[/\\]\.externalNativeBuild[/\\]/,
  /[/\\]\.cxx[/\\]/,
  /serviceAccountKey\.json$/i,
  /\.log$/i,
  /\.tmp$/i,
  /\.temp$/i,
  /^SistemaWISP_sin_dependencias[/\\]|[/\\]SistemaWISP_sin_dependencias[/\\]/,
];

function shouldExclude(relativePath) {
  const normalized = relativePath.replace(/\\/g, '/');
  return EXCLUDE_PATTERNS.some((re) => re.test(normalized));
}

function copyDir(src, dest, baseDir, stats) {
  baseDir = baseDir || src;
  if (!fs.existsSync(src)) return;

  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const e of entries) {
    const srcPath = path.join(src, e.name);
    const relPath = path.relative(baseDir, srcPath);

    if (e.isDirectory()) {
      if (shouldExclude(relPath + '/')) continue;
      copyDir(srcPath, path.join(dest, e.name), baseDir, stats);
    } else {
      if (shouldExclude(relPath)) continue;
      const destFile = path.join(dest, e.name);
      try {
        fs.copyFileSync(srcPath, destFile);
        stats.files++;
        if (stats.files % 500 === 0) process.stdout.write('.');
      } catch (err) {
        console.warn('\n  ⚠ No se pudo copiar:', relPath, err.message);
      }
    }
  }
}

function main() {
  console.log('\n=== Crear carpeta sin dependencias ===\n');
  console.log('Origen:', PROJECT_ROOT);
  console.log('Destino:', OUT_FOLDER);

  if (fs.existsSync(OUT_FOLDER)) {
    console.log('Eliminando carpeta existente...');
    fs.rmSync(OUT_FOLDER, { recursive: true });
  }
  runCopy();
}

function runCopy() {
  const stats = { files: 0 };
  console.log('\nCopiando archivos...');
  copyDir(PROJECT_ROOT, OUT_FOLDER, PROJECT_ROOT, stats);
  console.log('\n\n✓ Listo. Archivos copiados:', stats.files);

  const readmePath = path.join(OUT_FOLDER, 'LEEME_SIN_DEPENDENCIAS.txt');
  fs.writeFileSync(
    readmePath,
    `SistemaWISP - Copia sin dependencias
=====================================
Esta carpeta contiene todo el código y configuración, pero NO incluye:
- node_modules (dependencias Node/npm)
- .git (historial Git)
- .gradle, build (caché y compilados Android)
- client/dist, client/build (compilado del front)
- server/backups, server/uploads

Para poder ejecutar el sistema:
1. Ejecuta el archivo: descargar_dependencias.bat
   (o manualmente: npm install en raíz, server y client)
2. Crea server/.env con tu configuración (copia de .env.example si existe).
3. Para la app Android: abre android-app en Android Studio y sincroniza.

Para más información ver el README del proyecto.
`,
    'utf8'
  );
  console.log('Creado:', readmePath);
  console.log('\nAhora puedes ejecutar descargar_dependencias.bat para instalar dependencias.\n');
}

main();
