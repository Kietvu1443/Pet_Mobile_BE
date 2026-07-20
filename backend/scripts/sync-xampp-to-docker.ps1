param(
  [string]$DbName = "pet_helper",
  [string]$MysqlBin = "C:\xampp\mysql\bin",
  [string]$DbHost = "127.0.0.1",
  [int]$Port = 3306,
  [string]$User = "root",
  [string]$Password = "",
  [string]$BackupDir = ".\backups",
  [string]$DockerService = "db",
  [string]$TargetDb = "pet_helper",
  [string]$DockerRootUser = "root",
  [string]$DockerRootPassword = "root123",
  [switch]$NoReset
)

$projectRoot = Split-Path -Parent $PSScriptRoot
Push-Location $projectRoot

try {
  $backupScript = Join-Path $PSScriptRoot "backup-xampp.ps1"
  $restoreScript = Join-Path $PSScriptRoot "restore-docker.ps1"
  $shellExe = (Get-Process -Id $PID).Path

  if (-not (Test-Path $backupScript)) {
    throw "Không tìm thấy script backup: $backupScript"
  }
  if (-not (Test-Path $restoreScript)) {
    throw "Không tìm thấy script restore: $restoreScript"
  }

  Write-Host "=== STEP 1/2: Backup từ XAMPP ==="
  $backupArgs = @(
    "-ExecutionPolicy", "Bypass",
    "-File", $backupScript,
    "-DbName", $DbName,
    "-MysqlBin", $MysqlBin,
    "-DbHost", $DbHost,
    "-Port", $Port,
    "-User", $User,
    "-OutputDir", $BackupDir
  )

  if (-not [string]::IsNullOrWhiteSpace($Password)) {
    $backupArgs += @("-Password", $Password)
  }

  & $shellExe @backupArgs
  if ($LASTEXITCODE -ne 0) {
    throw "Backup thất bại"
  }

  $latestSql = Get-ChildItem -Path $BackupDir -Filter "$DbName*.sql" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
  if (-not $latestSql) {
    throw "Không tìm thấy file backup sau khi dump"
  }

  Write-Host "=== STEP 2/2: Restore vào Docker ==="
  $restoreArgs = @(
    "-ExecutionPolicy", "Bypass",
    "-File", $restoreScript,
    "-SqlFile", $latestSql.FullName,
    "-Service", $DockerService,
    "-TargetDb", $TargetDb,
    "-RootUser", $DockerRootUser,
    "-RootPassword", $DockerRootPassword
  )

  if ($NoReset) {
    $restoreArgs += "-NoReset"
  }

  & $shellExe @restoreArgs
  if ($LASTEXITCODE -ne 0) {
    throw "Restore thất bại"
  }

  Write-Host "✅ Sync hoàn tất với file: $($latestSql.FullName)"
}
finally {
  Pop-Location
}
