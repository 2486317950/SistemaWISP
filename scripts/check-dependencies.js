const fs = require('fs');
const path = require('path');

console.log('🔍 Verificando dependencias...\n');

const checkDependencies = (dir, name) => {
  const nodeModulesPath = path.join(dir, 'node_modules');
  const packageJsonPath = path.join(dir, 'package.json');
  
  if (!fs.existsSync(packageJsonPath)) {
    console.log(`⚠️  ${name}: No se encontró package.json (puede ser opcional)`);
    return true; // No es un error si no hay package.json
  }
  
  if (!fs.existsSync(nodeModulesPath)) {
    console.log(`❌ ${name}: node_modules no existe.`);
    console.log(`   Ejecuta 'npm install' en ${path.basename(dir)}\n`);
    return false;
  }
  
  // Verificar si node_modules está vacío
  try {
    const contents = fs.readdirSync(nodeModulesPath);
    if (contents.length === 0) {
      console.log(`❌ ${name}: node_modules está vacío.`);
      console.log(`   Ejecuta 'npm install' en ${path.basename(dir)}\n`);
      return false;
    }
  } catch (err) {
    console.log(`❌ ${name}: Error al leer node_modules.`);
    console.log(`   Ejecuta 'npm install' en ${path.basename(dir)}\n`);
    return false;
  }
  
  // Verificar dependencias críticas específicas según el tipo de proyecto
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const allDependencies = { ...(packageJson.dependencies || {}), ...(packageJson.devDependencies || {}) };
  
  // Definir dependencias críticas según el contexto
  let criticalDeps = [];
  if (name === 'Servidor') {
    criticalDeps = ['express', 'multer', 'sqlite3', 'cors', 'bcryptjs', 'jsonwebtoken'];
  } else if (name === 'Cliente') {
    criticalDeps = ['react', 'react-dom', 'vite', 'axios'];
  } else if (name === 'Raíz') {
    criticalDeps = ['concurrently'];
  }
  
  // Verificar solo las dependencias críticas que están en package.json
  const missing = [];
  for (const dep of criticalDeps) {
    if (allDependencies[dep]) {
      const depPath = path.join(nodeModulesPath, dep);
      if (!fs.existsSync(depPath)) {
        missing.push(dep);
      }
    }
  }
  
  if (missing.length > 0) {
    console.log(`❌ ${name}: Faltan dependencias críticas: ${missing.join(', ')}`);
    console.log(`   Ejecuta 'npm install' en ${path.basename(dir)}\n`);
    return false;
  }
  
  console.log(`✅ ${name}: Dependencias instaladas correctamente\n`);
  return true;
};

const rootDir = path.join(__dirname, '..');
const serverDir = path.join(rootDir, 'server');
const clientDir = path.join(rootDir, 'client');

const rootOk = checkDependencies(rootDir, 'Raíz');
const serverOk = checkDependencies(serverDir, 'Servidor');
const clientOk = checkDependencies(clientDir, 'Cliente');

if (!rootOk || !serverOk || !clientOk) {
  console.log('❌ Faltan dependencias. Por favor ejecuta:');
  console.log('   npm run install-all');
  console.log('\nO instala manualmente en cada directorio:');
  if (!rootOk) console.log('   - npm install (en la raíz)');
  if (!serverOk) console.log('   - cd server && npm install');
  if (!clientOk) console.log('   - cd client && npm install');
  process.exit(1);
}

console.log('✅ Todas las dependencias están instaladas correctamente.');
process.exit(0);

