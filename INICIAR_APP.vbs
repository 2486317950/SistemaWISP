Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

' Obtener el directorio del proyecto
projectDir = fso.GetParentFolderName(WScript.ScriptFullName)

' Cambiar al directorio del proyecto
WshShell.CurrentDirectory = projectDir

' Ejecutar el bat visible
WshShell.Run """" & projectDir & "\bat-scripts\INICIAR_APP_CON_NGROK_VISIBLE.bat""", 1, False

