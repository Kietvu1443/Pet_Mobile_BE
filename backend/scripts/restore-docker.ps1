param(
  [Parameter(Mandatory = $true)]
  [string]$SqlFile,
  [string]$Service = "db",
  [string]$TargetDb = "pet_helper",
  [string]$RootUser = "root",
  [string]$RootPassword = "root123",
  [switch]$NoReset
)

$projectRoot = Split-Path -Parent $PSScriptRoot
Push-Location $projectRoot

try {
  if (-not (Test-Path $SqlFile)) {
    throw "Không tìm thấy file SQL: $SqlFile"
  }

  $resolvedSql = (Resolve-Path $SqlFile).Path
  $tempSqlInContainer = "/tmp/pet_helper_restore.sql"

  Write-Host "Đang bật service Docker '$Service'..."
  docker compose up -d $Service | Out-Host
  if ($LASTEXITCODE -ne 0) {
    throw "Không thể bật Docker service '$Service'"
  }

  if (-not $NoReset) {
    Write-Host "Đang reset DB đích '$TargetDb'..."
    docker compose exec -T $Service mysql "-u$RootUser" "-p$RootPassword" -e "DROP DATABASE IF EXISTS $TargetDb; CREATE DATABASE $TargetDb CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;" | Out-Host
    if ($LASTEXITCODE -ne 0) {
      throw "Reset DB đích thất bại"
    }
  }

  Write-Host "Đang copy file SQL vào container..."
  $containerId = (docker compose ps -q $Service).Trim()
  if ([string]::IsNullOrWhiteSpace($containerId)) {
    throw "Không tìm thấy container ID cho service '$Service'"
  }

  docker cp $resolvedSql "$containerId`:$tempSqlInContainer" | Out-Host
  if ($LASTEXITCODE -ne 0) {
    throw "Copy file SQL vào container thất bại"
  }

  Write-Host "Đang import từ file: $resolvedSql"
  docker compose exec -T $Service mysql "-u$RootUser" "-p$RootPassword" "--default-character-set=utf8mb4" $TargetDb -e "source $tempSqlInContainer" | Out-Host
  if ($LASTEXITCODE -ne 0) {
    throw "Import dữ liệu thất bại"
  }

  docker compose exec -T $Service rm -f $tempSqlInContainer | Out-Host

  Write-Host "Đang kiểm tra nhanh số bản ghi..."
  docker compose exec -T $Service mysql "-u$RootUser" "-p$RootPassword" -D $TargetDb -e "SELECT (SELECT COUNT(*) FROM users) AS users_count, (SELECT COUNT(*) FROM pets) AS pets_count, (SELECT COUNT(*) FROM pet_images) AS pet_images_count, (SELECT COUNT(*) FROM pet_likes) AS pet_likes_count;" | Out-Host
  if ($LASTEXITCODE -ne 0) {
    throw "Kiểm tra dữ liệu sau restore thất bại"
  }

  Write-Host "✅ Restore thành công vào DB '$TargetDb'"
}
finally {
  Pop-Location
}
