param(
  [string]$Container = "god-eyes-postgis",
  [string]$Database = "god_eyes_dev",
  [string]$User = "god_eyes"
)

$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$migrationFiles = @(
  "database/migrations/core/001_core_ingestion_tables.sql",
  "database/migrations/layers/layer_01_aviation/001_aviation_reference_tables.sql"
)

$sqlParts = foreach ($relativePath in $migrationFiles) {
  $path = Join-Path $repoRoot $relativePath
  if (-not (Test-Path $path)) {
    throw "Migration not found: $relativePath"
  }

  Get-Content -Raw -Path $path
}

$sql = $sqlParts -join "`n`n"
$sql | docker exec -i $Container psql -v ON_ERROR_STOP=1 -U $User -d $Database
