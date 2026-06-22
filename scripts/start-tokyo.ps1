param(
  [int]$PreferredWebPort = 8082,
  [int]$PreferredApiPort = 8083
)

$ErrorActionPreference = "Stop"

function Write-Step($Message) {
  Write-Host ""
  Write-Host $Message -ForegroundColor Cyan
}

function Write-Info($Message) {
  Write-Host $Message -ForegroundColor Gray
}

function Find-FreePort([int]$StartPort) {
  for ($port = $StartPort; $port -lt ($StartPort + 50); $port++) {
    $existingListener = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    if ($existingListener) {
      Write-Info "Port $port is busy, trying $($port + 1)..."
      continue
    }

    $listener = $null
    try {
      $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $port)
      $listener.Start()
      return $port
    } catch {
      Write-Info "Port $port is busy, trying $($port + 1)..."
    } finally {
      if ($listener) {
        $listener.Stop()
      }
    }
  }

  throw "Could not find a free localhost port starting at $StartPort."
}

function Wait-ForUrl([string]$Url, [string]$Name, [int]$TimeoutSeconds = 90) {
  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    try {
      $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 3
      if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) {
        Write-Host "$Name is ready." -ForegroundColor Green
        return
      }
    } catch {
      Start-Sleep -Seconds 2
    }
  }

  throw "$Name did not become ready at $Url within $TimeoutSeconds seconds."
}

function Get-TokyoApiStatus([int]$Port) {
  try {
    $status = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/api/settings/status" -TimeoutSec 2
    if ($status.app.id -eq "tokyo-personal-ai") {
      return $status
    }
  } catch {
    return $null
  }

  return $null
}

function Find-ExistingTokyoApi([int]$StartPort) {
  for ($port = $StartPort; $port -lt ($StartPort + 50); $port++) {
    $status = Get-TokyoApiStatus $port
    if ($status) {
      return @{
        Port = $port
        Url = "http://127.0.0.1:$port"
      }
    }
  }

  return $null
}

try {
  $ProjectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
  Set-Location $ProjectRoot

  Write-Host "Starting Tokyo Personal AI..." -ForegroundColor Cyan
  Write-Info "Project folder: $ProjectRoot"

  if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    throw "Node.js was not found. Install Node.js 22 LTS or newer, then run this launcher again."
  }

  if (-not (Test-Path "node_modules")) {
    Write-Step "Installing dependencies..."
    npm install
    if ($LASTEXITCODE -ne 0) {
      throw "npm install failed. Check the npm error above, then run the launcher again."
    }
  } else {
    Write-Info "Dependencies already installed."
  }

  $webPort = Find-FreePort $PreferredWebPort
  $existingApi = Find-ExistingTokyoApi $PreferredApiPort
  if ($existingApi) {
    $apiPort = [int]$existingApi.Port
    $apiUrl = [string]$existingApi.Url
    Write-Info "Reusing existing Tokyo local API at $apiUrl."
  } else {
    $apiPort = Find-FreePort $PreferredApiPort
    $apiUrl = "http://127.0.0.1:$apiPort"
  }

  $appUrl = "http://127.0.0.1:$webPort"
  $openUrl = "$appUrl/?apiBaseUrl=$([uri]::EscapeDataString($apiUrl))"

  $runtimeDir = Join-Path $ProjectRoot ".tokyo-runtime"
  if (-not (Test-Path $runtimeDir)) {
    New-Item -ItemType Directory -Path $runtimeDir | Out-Null
  }

  $processes = @()

  if ($existingApi) {
    Write-Info "Local API is already running."
  } elseif (Test-Path "server\index.js") {
    Write-Step "Starting local API..."
    $apiOut = Join-Path $runtimeDir "api.out.log"
    $apiErr = Join-Path $runtimeDir "api.err.log"
    $apiEnv = "cd /d `"$ProjectRoot`" && set API_PORT=$apiPort && node server\index.js"
    $apiProcess = Start-Process -FilePath "cmd.exe" -ArgumentList "/c", $apiEnv -PassThru -WindowStyle Hidden -RedirectStandardOutput $apiOut -RedirectStandardError $apiErr
    $processes += $apiProcess
    Wait-ForUrl "$apiUrl/api/settings/status" "Local API" 45
    $apiStatus = Get-TokyoApiStatus $apiPort
    if ($apiStatus -and $apiStatus.app.port) {
      $actualApiPort = [int]$apiStatus.app.port
      if ($actualApiPort -ne $apiPort) {
        $apiPort = $actualApiPort
        $apiUrl = "http://127.0.0.1:$apiPort"
        $openUrl = "$appUrl/?apiBaseUrl=$([uri]::EscapeDataString($apiUrl))"
        Write-Info "Local API selected port $apiPort."
      }
    }
  } else {
    Write-Info "No local API server found. Tokyo will use local demo fallback where needed."
  }

  Write-Step "Starting web app..."
  $webOut = Join-Path $runtimeDir "web.out.log"
  $webErr = Join-Path $runtimeDir "web.err.log"
  $webCommand = "cd /d `"$ProjectRoot`" && set EXPO_PUBLIC_API_BASE_URL=$apiUrl && npx expo start --web --port $webPort"
  $webProcess = Start-Process -FilePath "cmd.exe" -ArgumentList "/c", $webCommand -PassThru -WindowStyle Hidden -RedirectStandardOutput $webOut -RedirectStandardError $webErr
  $processes += $webProcess
  Wait-ForUrl $appUrl "Tokyo web app" 120

  Write-Step "Opening app..."
  Start-Process $openUrl

  Write-Host ""
  Write-Host "Tokyo Personal AI is running." -ForegroundColor Green
  Write-Host "App: $appUrl" -ForegroundColor White
  Write-Host "API: $apiUrl" -ForegroundColor White
  Write-Host "Logs: $runtimeDir" -ForegroundColor White
  Write-Host ""
  Write-Host "Close this window to stop Tokyo Personal AI." -ForegroundColor Yellow

  try {
    while ($true) {
      foreach ($process in $processes) {
        if ($process.HasExited) {
          throw "A Tokyo service stopped unexpectedly. Check logs in $runtimeDir."
        }
      }
      Start-Sleep -Seconds 3
    }
  } finally {
    Write-Step "Stopping Tokyo Personal AI..."
    foreach ($process in $processes) {
      if ($process -and -not $process.HasExited) {
        Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
      }
    }
  }
} catch {
  Write-Host ""
  Write-Host "Tokyo Personal AI could not start." -ForegroundColor Red
  Write-Host $_.Exception.Message -ForegroundColor Yellow
  Write-Host ""
  Write-Host "Beginner checklist:" -ForegroundColor Cyan
  Write-Host "1. Install Node.js 22 LTS or newer."
  Write-Host "2. Make sure this folder is not inside a protected system directory."
  Write-Host "3. Run the launcher again."
  Write-Host "4. If it still fails, check .tokyo-runtime logs."
  exit 1
}
