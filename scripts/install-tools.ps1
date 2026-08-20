# Life OS optional-tools installer (Windows).
# Usage: powershell -ExecutionPolicy Bypass -File install-tools.ps1 ollama|tmux|claude|all
param([Parameter(Mandatory = $true)][ValidateSet('ollama', 'tmux', 'claude', 'all')][string]$Target)

$ErrorActionPreference = 'Continue'
$script:Failed = $false
$env:Path = "$env:LOCALAPPDATA\Programs\Ollama;$env:APPDATA\npm;$env:Path"

function Say($m)  { Write-Output "==> $m" }
function Ok($m)   { Write-Output "    ok: $m" }
function Warn($m) { Write-Output "    warning: $m" }
function Fail($m) { Write-Output "    FAILED: $m"; $script:Failed = $true }
function Has($cmd) { return [bool](Get-Command $cmd -ErrorAction SilentlyContinue) }

function Install-Ollama {
  Say 'Ollama (local AI)'
  if (Has 'ollama') { Ok "already installed at $((Get-Command ollama).Source)" }
  elseif (-not (Has 'winget')) { Fail 'winget not found. Install Ollama from https://ollama.com/download'; return }
  else {
    winget install -e --id Ollama.Ollama --accept-source-agreements --accept-package-agreements --silent
    if ($LASTEXITCODE -ne 0 -and $LASTEXITCODE -ne -1978335189) { Fail "winget install Ollama.Ollama (exit $LASTEXITCODE)"; return }
    $env:Path = "$env:LOCALAPPDATA\Programs\Ollama;$env:Path"
    Ok 'installed via winget'
  }
  try {
    Invoke-WebRequest -Uri 'http://localhost:11434/api/tags' -TimeoutSec 2 -UseBasicParsing | Out-Null
    Ok 'Ollama is running'
  } catch {
    Say 'starting Ollama'
    $exe = Join-Path $env:LOCALAPPDATA 'Programs\Ollama\ollama app.exe'
    if (Test-Path $exe) { Start-Process -FilePath $exe -WindowStyle Hidden }
    elseif (Has 'ollama') { Start-Process -FilePath 'ollama' -ArgumentList 'serve' -WindowStyle Hidden }
    Start-Sleep -Seconds 3
    Ok 'Ollama start requested (it will appear in the system tray)'
  }
}

function Install-Tmux {
  Say 'tmux (Kairos terminal)'
  Warn 'tmux is not available on Windows; the Kairos terminal requires WSL or macOS/Linux.'
}

function Install-Claude {
  Say 'Claude Code CLI (Kairos)'
  if (Has 'claude') { Ok "already installed at $((Get-Command claude).Source)"; return }
  if (-not (Has 'npm')) { Fail 'npm not found. Install Node.js (LTS) from https://nodejs.org and run this again.'; return }
  npm install -g @anthropic-ai/claude-code
  if ($LASTEXITCODE -ne 0) { Fail 'npm install -g @anthropic-ai/claude-code'; return }
  Ok 'installed'
}

switch ($Target) {
  'ollama' { Install-Ollama }
  'tmux'   { Install-Tmux }
  'claude' { Install-Claude }
  'all'    { Install-Ollama; Install-Tmux; Install-Claude }
}

if ($script:Failed) { Say 'finished with errors'; exit 1 }
Say 'done'
exit 0
