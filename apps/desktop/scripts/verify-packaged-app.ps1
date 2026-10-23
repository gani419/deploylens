param(
  [string]$Executable = (Join-Path $PSScriptRoot '..\release\win-unpacked\DeployLens.exe'),
  [string]$Fixture = (Join-Path $PSScriptRoot '..\..\..\fixtures\android\valid-app.apk'),
  [int]$Port = 32123
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Net.Http
$previousRunAsNode = $env:ELECTRON_RUN_AS_NODE
$previousPort = $env:DEPLOYLENS_DESKTOP_PORT
$previousUserData = $env:DEPLOYLENS_DESKTOP_USER_DATA
$previousDisableGpu = $env:DEPLOYLENS_DISABLE_GPU
Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue
$env:DEPLOYLENS_DESKTOP_PORT = [string]$Port
$env:DEPLOYLENS_DESKTOP_USER_DATA = (Join-Path $PSScriptRoot '..\release\qualification-user-data')
$env:DEPLOYLENS_DISABLE_GPU = '1'
$process = $null

try {
  # The CI/workspace host blocks Electron child-process sandbox access. These flags are
  # limited to this qualification script; the shipped shortcut retains the sandbox.
  $process = Start-Process -FilePath (Resolve-Path $Executable) -ArgumentList '--no-sandbox','--disable-gpu','--disable-software-rasterizer' -PassThru -WindowStyle Hidden
  $health = $null
  for ($attempt = 0; $attempt -lt 30; $attempt++) {
    try {
      $health = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/api/health" -TimeoutSec 2
      break
    } catch {
      Start-Sleep -Milliseconds 500
    }
  }
  if ($null -eq $health) { throw 'The packaged app did not expose its local service.' }

  $client = [System.Net.Http.HttpClient]::new()
  try {
    $bytes = [System.IO.File]::ReadAllBytes((Resolve-Path $Fixture))
    $content = [System.Net.Http.ByteArrayContent]::new($bytes)
    $content.Headers.ContentType = [System.Net.Http.Headers.MediaTypeHeaderValue]::new('application/octet-stream')
    $response = $client.PostAsync("http://127.0.0.1:$Port/api/scans?filename=valid-app.apk", $content).GetAwaiter().GetResult()
    $body = $response.Content.ReadAsStringAsync().GetAwaiter().GetResult()
    if (-not $response.IsSuccessStatusCode) { throw "Inspection returned HTTP $([int]$response.StatusCode): $body" }
    if (-not $body.Contains('"type":"scan.completed"')) { throw 'The packaged inspection did not complete.' }
  } finally {
    $client.Dispose()
  }

  Write-Output "Packaged desktop inspection passed on http://127.0.0.1:$Port."
} finally {
  if ($null -ne $process -and -not $process.HasExited) {
    $taskkill = Start-Process -FilePath 'taskkill.exe' -ArgumentList '/PID',$process.Id,'/T','/F' -PassThru -Wait -WindowStyle Hidden
    if ($taskkill.ExitCode -ne 0) {
      Get-Process -Name $process.ProcessName -ErrorAction SilentlyContinue | Stop-Process -Force
    }
  }
  if ($null -eq $previousRunAsNode) { Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue } else { $env:ELECTRON_RUN_AS_NODE = $previousRunAsNode }
  if ($null -eq $previousPort) { Remove-Item Env:DEPLOYLENS_DESKTOP_PORT -ErrorAction SilentlyContinue } else { $env:DEPLOYLENS_DESKTOP_PORT = $previousPort }
  if ($null -eq $previousUserData) { Remove-Item Env:DEPLOYLENS_DESKTOP_USER_DATA -ErrorAction SilentlyContinue } else { $env:DEPLOYLENS_DESKTOP_USER_DATA = $previousUserData }
  if ($null -eq $previousDisableGpu) { Remove-Item Env:DEPLOYLENS_DISABLE_GPU -ErrorAction SilentlyContinue } else { $env:DEPLOYLENS_DISABLE_GPU = $previousDisableGpu }
}
