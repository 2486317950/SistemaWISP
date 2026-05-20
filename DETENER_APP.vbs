Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

' Obtener el directorio del proyecto
projectDir = fso.GetParentFolderName(WScript.ScriptFullName)

' Ejecutar el script de detener del subdirectorio
WshShell.Run """" & projectDir & "\bat-scripts\DETENER_TODO.vbs""", 0, False




