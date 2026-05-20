const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const os = require('os');

console.log('🔗 Creando acceso directo...\n');

const scriptDir = __dirname.replace(/\\scripts$/, '');
const shortcutName = 'Sistema ISP CDCom.lnk';
const shortcutPath = path.join(scriptDir, shortcutName);

try {
  // Verificar que estamos en Windows
  if (process.platform !== 'win32') {
    console.error('❌ Este script solo funciona en Windows.');
    process.exit(1);
  }

  // Eliminar acceso directo existente si existe
  if (fs.existsSync(shortcutPath)) {
    console.log('⚠️  Eliminando acceso directo existente...');
    try {
      fs.unlinkSync(shortcutPath);
    } catch (err) {
      console.error('❌ No se pudo eliminar el acceso directo existente.');
      console.error('   Por favor, elimínalo manualmente e intenta de nuevo.');
      process.exit(1);
    }
  }

  console.log('📝 Creando acceso directo...');
  console.log(`   Nombre: ${shortcutName}`);
  console.log(`   Ubicación: ${scriptDir}\n`);

  // Intentar usar VBScript primero (más confiable en Windows)
  const vbsScript = path.join(__dirname, 'create-shortcut.vbs');
  
  if (fs.existsSync(vbsScript)) {
    try {
      console.log('   Usando VBScript...');
      execSync(
        `cscript //nologo "${vbsScript}"`,
        { stdio: 'inherit', shell: true, cwd: scriptDir }
      );
    } catch (vbsError) {
      console.log('   VBScript falló, usando PowerShell...');
      // Continuar con PowerShell
    }
  }
  
  // Si VBScript no existe o falló, usar PowerShell
  if (!fs.existsSync(shortcutPath)) {
    // Crear un archivo temporal de PowerShell
    const tempPsScript = path.join(os.tmpdir(), 'create-shortcut.ps1');
    const psScriptContent = `$WshShell = New-Object -ComObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut('${shortcutPath.replace(/'/g, "''")}')
$Shortcut.TargetPath = 'cmd.exe'
$Shortcut.Arguments = '/c "cd /d ${scriptDir.replace(/\\/g, '/').replace(/ /g, '` ')} && npm run dev && pause"'
$Shortcut.WorkingDirectory = '${scriptDir.replace(/'/g, "''")}'
$Shortcut.Description = 'Sistema ISP CDCom - Iniciar Aplicación'
$Shortcut.IconLocation = 'shell32.dll,137'
$Shortcut.Save()
Write-Host 'Acceso directo creado exitosamente.'`;

    // Escribir el script de PowerShell temporal
    fs.writeFileSync(tempPsScript, psScriptContent, 'utf8');

    try {
      // Ejecutar el script de PowerShell
      execSync(
        `powershell -NoProfile -ExecutionPolicy Bypass -File "${tempPsScript}"`,
        { stdio: 'inherit', shell: true, cwd: scriptDir }
      );

      // Eliminar el archivo temporal
      try {
        fs.unlinkSync(tempPsScript);
      } catch (err) {
        // Ignorar errores al eliminar el archivo temporal
      }
    } catch (psError) {
      // Eliminar el archivo temporal en caso de error
      try {
        fs.unlinkSync(tempPsScript);
      } catch (err) {
        // Ignorar
      }
      throw psError;
    }
  }

  // Verificar que se creó correctamente
  if (fs.existsSync(shortcutPath)) {
    console.log('\n✅ Acceso directo creado exitosamente!');
    console.log(`\n📁 Ubicación: ${shortcutPath}`);
    console.log('\n💡 Puedes hacer doble clic en el acceso directo para iniciar la aplicación.');
    console.log('   La aplicación instalará las dependencias automáticamente si es necesario.\n');
    process.exit(0);
  } else {
    console.error('\n❌ El acceso directo no se creó correctamente.');
    process.exit(1);
  }
} catch (error) {
  console.error('\n❌ Error al crear el acceso directo:');
  console.error(error.message);
  console.error('\n💡 Intentando método alternativo...\n');
  
  // Método alternativo: usar el script BAT
  try {
    const batScript = path.join(scriptDir, 'crear-acceso-directo.bat');
    if (fs.existsSync(batScript)) {
      console.log('Ejecutando crear-acceso-directo.bat...\n');
      execSync(`"${batScript}"`, { stdio: 'inherit', shell: true, cwd: scriptDir });
    } else {
      console.error('No se encontró el script alternativo.');
      console.error('\n💡 Posibles soluciones:');
      console.error('   1. Ejecuta este script como Administrador');
      console.error('   2. Verifica que PowerShell esté disponible');
      console.error('   3. Verifica los permisos de escritura en la carpeta\n');
      process.exit(1);
    }
  } catch (batError) {
    console.error('❌ El método alternativo también falló.');
    console.error('\n💡 Posibles soluciones:');
    console.error('   1. Ejecuta este script como Administrador');
    console.error('   2. Verifica que PowerShell esté disponible');
    console.error('   3. Verifica los permisos de escritura en la carpeta\n');
    process.exit(1);
  }
}

