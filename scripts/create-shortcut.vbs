Set WshShell = WScript.CreateObject("WScript.Shell")
Set fso = WScript.CreateObject("Scripting.FileSystemObject")

' Obtener el directorio del script
scriptPath = fso.GetParentFolderName(WScript.ScriptFullName)
projectDir = fso.GetParentFolderName(scriptPath)
shortcutPath = projectDir & "\Sistema ISP CDCom.lnk"

' Escapar comillas en la ruta del proyecto si tiene espacios
projectDirQuoted = Chr(34) & projectDir & Chr(34)

' Crear el acceso directo que ejecuta el script BAT
Set Shortcut = WshShell.CreateShortcut(shortcutPath)
Shortcut.TargetPath = projectDir & "\bat-scripts\INICIAR_APP_SIMPLE.bat"
Shortcut.WorkingDirectory = projectDir
Shortcut.Description = "Sistema ISP CDCom - Iniciar Aplicación"
Shortcut.IconLocation = "shell32.dll,137"
Shortcut.Save

WScript.Echo "Acceso directo creado exitosamente en: " & shortcutPath
WScript.Quit 0

