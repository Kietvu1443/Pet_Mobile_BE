param(
  [string]$DbName = "pet_helper",
  [string]$MysqlBin = "C:\xampp\mysql\bin",
  [string]$DbHost = "127.0.0.1",
  [int]$Port = 3306,
  [string]$User = "root",
  [string]$Password = "",
  [string]$OutputDir = ".\backups"
)

$projectRoot = Split-Path -Parent $PSScriptRoot
Push-Location $projectRoot

try {
  $mysqldump = Join-Path $MysqlBin "mysqldump.exe"
  if (-not (Test-Path $mysqldump)) {
    throw "Không tìm thấy mysqldump tại: $mysqldump"
  }

  if (-not (Test-Path $OutputDir)) {
    New-Item -ItemType Directory -Path $OutputDir | Out-Null
  }

  $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
  $outputFile = Join-Path $OutputDir ("{0}_{1}.sql" -f $DbName, $timestamp)

  $arguments = @(
    "-h", $DbHost,
    "-P", $Port,
    "-u", $User,
    "--single-transaction",
    "--routines",
    "--triggers",
    "--events",
    "--default-character-set=utf8mb4",
    "--result-file=$outputFile",
    $DbName
  )

  if (-not [string]::IsNullOrWhiteSpace($Password)) {
    $arguments = @("-p$Password") + $arguments
  }

  Write-Host "Đang backup DB '$DbName' từ XAMPP..."
  & $mysqldump @arguments

  if ($LASTEXITCODE -ne 0) {
    throw "Backup thất bại (exit code: $LASTEXITCODE)"
  }

  Write-Host "✅ Backup thành công: $outputFile"
}
finally {
  Pop-Location
}
