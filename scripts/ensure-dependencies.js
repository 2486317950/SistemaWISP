const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🔍 Verificando e instalando dependencias automáticamente...\n');

const installDependencies = (dir, name) => {
  const nodeModulesPath = path.join(dir, 'node_modules');
  const packageJsonPath = path.join(dir, 'package.json');
  
  if (!fs.existsSync(packageJsonPath)) {
    console.log(`⚠️  ${name}: No se encontró package.json (omitido)\n`);
    return true;
  }
  
  let needsInstall = false;
  
  // Verificar si node_modules existe y tiene contenido
  if (!fs.existsSync(nodeModulesPath)) {
    console.log(`📦 ${name}: node_modules no existe. Instalando dependencias...`);
    needsInstall = true;
  } else {
    try {
      const contents = fs.readdirSync(nodeModulesPath);
      if (contents.length === 0) {
        console.log(`📦 ${name}: node_modules está vacío. Instalando dependencias...`);
        needsInstall = true;
      }
    } catch (err) {
      console.log(`📦 ${name}: Error al leer node_modules. Reinstalando dependencias...`);
      needsInstall = true;
    }
  }
  
  // Verificar dependencias críticas
  if (!needsInstall) {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    const allDependencies = { ...(packageJson.dependencies || {}), ...(packageJson.devDependencies || {}) };
    
    let criticalDeps = [];
    if (name === 'Servidor') {
      criticalDeps = ['express', 'multer', 'sqlite3', 'cors', 'bcryptjs', 'jsonwebtoken'];
    } else if (name === 'Cliente') {
      criticalDeps = ['react', 'react-dom', 'vite', 'axios'];
    } else if (name === 'Raíz') {
      criticalDeps = ['concurrently'];
    }
    
    // Verificar dependencias críticas
    for (const dep of criticalDeps) {
      if (allDependencies[dep]) {
        const depPath = path.join(nodeModulesPath, dep);
        if (!fs.existsSync(depPath)) {
          console.log(`📦 ${name}: Faltan dependencias críticas (${dep}). Instalando...`);
          needsInstall = true;
          break;
        }
      }
    }
  }
  
  if (needsInstall) {
    try {
      console.log(`   ⏳ Instalando en ${path.basename(dir)}...`);
      console.log(`   (Esto puede tardar unos minutos la primera vez)\n`);
      execSync('npm install --no-audit --no-fund', {
        cwd: dir,
        stdio: 'inherit',
        shell: true,
        env: { ...process.env }
      });
      console.log(`\n✅ ${name}: Dependencias instaladas correctamente\n`);
      return true;
    } catch (error) {
      console.error(`\n❌ ${name}: Error al instalar dependencias`);
      console.error(`   Directorio: ${dir}`);
      console.error(`   Intenta ejecutar manualmente: cd "${dir}" && npm install\n`);
      return false;
    }
  } else {
    console.log(`✅ ${name}: Todas las dependencias están instaladas\n`);
    return true;
  }
};

const rootDir = path.join(__dirname, '..');
const serverDir = path.join(rootDir, 'server');
const clientDir = path.join(rootDir, 'client');

console.log('Verificando dependencias del proyecto...\n');

const rootOk = installDependencies(rootDir, 'Raíz');
const serverOk = installDependencies(serverDir, 'Servidor');
const clientOk = installDependencies(clientDir, 'Cliente');

if (!rootOk || !serverOk || !clientOk) {
  console.error('❌ Error al instalar dependencias. Por favor verifica los errores arriba.');
  process.exit(1);
}

console.log('✅ Todas las dependencias están listas. Iniciando aplicación...\n');
process.exit(0);

