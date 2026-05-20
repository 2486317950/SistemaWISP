// Script para limpiar caché antes de iniciar
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const distPath = path.join(__dirname, 'dist');
const viteCachePath = path.join(__dirname, 'node_modules', '.vite');

function deleteFolderRecursive(folderPath) {
  if (fs.existsSync(folderPath)) {
    fs.readdirSync(folderPath).forEach((file) => {
      const curPath = path.join(folderPath, file);
      if (fs.lstatSync(curPath).isDirectory()) {
        deleteFolderRecursive(curPath);
      } else {
        fs.unlinkSync(curPath);
      }
    });
    fs.rmdirSync(folderPath);
    console.log(`✓ Eliminado: ${folderPath}`);
  }
}

console.log('🧹 Limpiando caché...');

// Limpiar dist
if (fs.existsSync(distPath)) {
  deleteFolderRecursive(distPath);
}

// Limpiar caché de Vite
if (fs.existsSync(viteCachePath)) {
  deleteFolderRecursive(viteCachePath);
}

console.log('✅ Caché limpiada correctamente');

