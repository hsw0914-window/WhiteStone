$ErrorActionPreference = "Stop"

$port = 8000
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$python = Join-Path $root "venv\Scripts\python.exe"

if (-not (Test-Path $python)) {
  Write-Error "venv Python을 찾을 수 없습니다: $python"
}

$listeners = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
if ($listeners) {
  $pids = $listeners | Select-Object -ExpandProperty OwningProcess -Unique
  foreach ($pid in $pids) {
    Write-Host "기존 $port 포트 프로세스 종료: $pid"
    Stop-Process -Id $pid -Force
  }
}

Write-Host "백엔드 시작: http://0.0.0.0:$port"
Set-Location $root
& $python -m uvicorn main:app --host 0.0.0.0 --port $port
