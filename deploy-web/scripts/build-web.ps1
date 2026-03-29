$ErrorActionPreference = "Stop"

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot "..\\..")
$frontendRoot = Join-Path $projectRoot "Frontend\\ev-arkadasim-frontend-son-hali"
$outputRoot = Join-Path $projectRoot "web\\dist"

Write-Host "Expo web build baslatiliyor..."
Push-Location $frontendRoot
try {
  npm run web:build
}
finally {
  Pop-Location
}

if (Test-Path $outputRoot) {
  Remove-Item -LiteralPath $outputRoot -Recurse -Force
}

New-Item -ItemType Directory -Path $outputRoot | Out-Null
Copy-Item -Path (Join-Path $frontendRoot "dist\\*") -Destination $outputRoot -Recurse -Force

Write-Host "Web build hazir: $outputRoot"
