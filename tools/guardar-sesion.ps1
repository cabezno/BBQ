<#
  guardar-sesion.ps1
  Guarda la sesión de ESTA consola de PowerShell (comandos + lo que se ve en
  pantalla) en un .txt y deja un acceso directo en el Escritorio.

  Uso, desde la consola que querés guardar:
      .\guardar-sesion.ps1
      .\guardar-sesion.ps1 -Nombre "deploy-server"

  Tiene que correrse DENTRO de la consola (no con doble clic ni "Ejecutar con
  PowerShell"), porque lee el historial y el buffer de la ventana actual.
#>
param(
    [string]$Nombre = ''
)

$ErrorActionPreference = 'Stop'

# Escritorio real del usuario (respeta la redirección de OneDrive)
$escritorio = [Environment]::GetFolderPath('Desktop')
$carpeta    = Join-Path $escritorio 'Sesiones de consola'
New-Item -ItemType Directory -Force -Path $carpeta | Out-Null

$ahora   = Get-Date
$sello   = $ahora.ToString('yyyy-MM-dd_HH-mm-ss')
$etiqueta = if ($Nombre) { $Nombre -replace '[\\/:*?"<>|]', '_' } else { "PID$PID" }
$base    = "sesion_${etiqueta}_$sello"
$archivo = Join-Path $carpeta "$base.txt"

$out = New-Object System.Text.StringBuilder
[void]$out.AppendLine("Sesión de consola guardada el $($ahora.ToString('yyyy-MM-dd HH:mm:ss'))")
[void]$out.AppendLine("Host:      $($Host.Name)  (PowerShell $($PSVersionTable.PSVersion))")
[void]$out.AppendLine("Proceso:   $PID")
[void]$out.AppendLine("Usuario:   $env:USERNAME@$env:COMPUTERNAME")
[void]$out.AppendLine("Carpeta:   $((Get-Location).Path)")
[void]$out.AppendLine('')

# 1) Comandos ejecutados en ESTA consola (Get-History es por sesión, no global)
[void]$out.AppendLine('=' * 70)
[void]$out.AppendLine('COMANDOS DE ESTA CONSOLA')
[void]$out.AppendLine('=' * 70)
$historial = Get-History
if ($historial) {
    foreach ($h in $historial) {
        $inicio = $h.StartExecutionTime.ToString('HH:mm:ss')
        $estado = if ($h.ExecutionStatus -ne 'Completed') { "  [$($h.ExecutionStatus)]" } else { '' }
        [void]$out.AppendLine("[$inicio] #$($h.Id)$estado  $($h.CommandLine)")
    }
} else {
    [void]$out.AppendLine('(sin comandos en el historial)')
}
[void]$out.AppendLine('')

# 2) Lo que muestra la ventana (comandos + salida), si el host lo permite
[void]$out.AppendLine('=' * 70)
[void]$out.AppendLine('CONTENIDO DE LA PANTALLA')
[void]$out.AppendLine('=' * 70)
try {
    $raw   = $Host.UI.RawUI
    $ancho = $raw.BufferSize.Width
    $alto  = $raw.CursorPosition.Y
    $rect  = New-Object System.Management.Automation.Host.Rectangle 0, 0, ($ancho - 1), $alto
    $celdas = $raw.GetBufferContents($rect)
    $lineas = New-Object System.Collections.Generic.List[string]
    for ($y = 0; $y -le $alto; $y++) {
        $sb = New-Object System.Text.StringBuilder
        for ($x = 0; $x -lt $ancho; $x++) {
            $c = $celdas[$y, $x]
            if ($c.BufferCellType -ne 'Trailing') { [void]$sb.Append($c.Character) }
        }
        $lineas.Add($sb.ToString().TrimEnd())
    }
    # Quitar líneas vacías del principio
    while ($lineas.Count -gt 0 -and $lineas[0] -eq '') { $lineas.RemoveAt(0) }
    foreach ($l in $lineas) { [void]$out.AppendLine($l) }
} catch {
    [void]$out.AppendLine("(este host no permite leer la pantalla: $($_.Exception.Message))")
    [void]$out.AppendLine('Tip: en VS Code/ISE solo se guardan los comandos de arriba.')
}

$out.ToString() | Out-File -FilePath $archivo -Encoding utf8

# Acceso directo en el Escritorio que abre el .txt
$lnk = Join-Path $escritorio "$base.lnk"
$wsh = New-Object -ComObject WScript.Shell
$atajo = $wsh.CreateShortcut($lnk)
$atajo.TargetPath       = $archivo
$atajo.WorkingDirectory = $carpeta
$atajo.Description      = "Sesión de consola $etiqueta ($sello)"
$atajo.Save()

Write-Host "Sesión guardada en: $archivo" -ForegroundColor Green
Write-Host "Acceso directo:     $lnk"     -ForegroundColor Green
