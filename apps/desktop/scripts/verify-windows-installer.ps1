param(
  [string]$Installer = (Join-Path $PSScriptRoot '..\release\DeployLens-1.0.0-win-x64.exe'),
  [string]$InstallDirectory = (Join-Path $PSScriptRoot '..\release\qualification-install')
)

$ErrorActionPreference = 'Stop'
$releaseRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\release'))
$target = [System.IO.Path]::GetFullPath($InstallDirectory)
if (-not $target.StartsWith($releaseRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
  throw 'The qualification install directory must remain inside apps/desktop/release.'
}

$installedExecutable = Join-Path $target 'DeployLens.exe'
$uninstaller = Join-Path $target 'Uninstall DeployLens.exe'

try {
  $install = Start-Process -FilePath (Resolve-Path $Installer) -ArgumentList '/S',"/D=$target" -PassThru -Wait -WindowStyle Hidden
  if ($install.ExitCode -ne 0 -or -not (Test-Path $installedExecutable)) {
    throw "Silent installation failed with exit code $($install.ExitCode)."
  }

  $verification = Start-Process -FilePath 'powershell.exe' -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-File',(Join-Path $PSScriptRoot 'verify-packaged-app.ps1'),'-Executable',$installedExecutable,'-Port','32124' -PassThru -Wait -NoNewWindow
  if ($verification.ExitCode -ne 0) { throw 'The installed application failed its inspection check.' }
  Write-Output 'Windows installer, installed application, and local inspection passed.'
} finally {
  if (Test-Path $uninstaller) {
    $uninstall = Start-Process -FilePath $uninstaller -ArgumentList '/S' -PassThru -Wait -WindowStyle Hidden
    if ($uninstall.ExitCode -ne 0) { throw "Silent uninstall failed with exit code $($uninstall.ExitCode)." }
  }
}

if (Test-Path $installedExecutable) { throw 'The uninstaller left the application executable behind.' }
Write-Output 'Windows uninstall passed.'
