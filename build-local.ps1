# Local MMIP Package Builder
# This script creates a .mmip package locally for testing
# 
# Updated to use refactored modular structure (Phases 1-7)
# Supports MM5 5.0+

Write-Host "Building MMIP package locally..." -ForegroundColor Cyan

# Use fixed version for local builds (GitHub builds use info.json version)
$version = "0.0.1"

Write-Host "Local build version: $version" -ForegroundColor Green
Write-Host "MM5 Compatibility: 5.0+" -ForegroundColor Gray

# Create bin folder if it doesn't exist
$binFolder = "bin"
if (-not (Test-Path $binFolder)) {
    New-Item -ItemType Directory -Path $binFolder | Out-Null
    Write-Host "Created bin folder" -ForegroundColor Yellow
}

# Define package name
$packageName = Join-Path $binFolder "SimilarArtists-$version.mmip"

# Remove old package if it exists
if (Test-Path $packageName) {
    Remove-Item $packageName
    Write-Host "Removed existing package: $packageName" -ForegroundColor Yellow
}

# Define files to include in the package
# Main entry point and config
$filesToInclude = @(
    "info.json",
    "init.js",
    "actions_add.js",
    "smiley_yellow_128.png",
    "README.md"
)

# Add all module files (Phases 1-7)
$moduleFiles = @(
    "modules\config.js",
    "modules\index.js",
    "modules\README.md",
    # Phase 1: Configuration
    # (included in config.js)
    # Phase 2: Settings and utilities
    "modules\settings\storage.js",
    "modules\settings\prefixes.js",
    "modules\settings\lastfm.js",
    "modules\utils\normalization.js",
    "modules\utils\helpers.js",
    "modules\utils\sql.js",
    # Phase 3: Notifications and UI
    "modules\ui\notifications.js",
    # Phase 4: Database and library
    "modules\db\index.js",
    "modules\db\library.js",
    "modules\db\playlist.js",
    "modules\db\queue.js",
    # Phase 5: Orchestration
    "modules\core\orchestration.js",
    # Phase 6: Auto-mode
    "modules\core\autoMode.js",
    # Phase 7: MM5 Integration
    "modules\core\mm5Integration.js",
    # API Integration
    "modules\api\lastfm.js",
    "modules\api\cache.js"
)

# Add dialog files
$dialogFiles = @(
    "dialogs\dlgOptions_add.js",
    "dialogs\dlgOptions\pnl_SimilarArtists.js"
)

# Combine all files
$filesToInclude += $moduleFiles + $dialogFiles

# Verify all files exist
Write-Host "`nVerifying files..." -ForegroundColor Cyan
$missingFiles = @()
foreach ($file in $filesToInclude) {
    if (-not (Test-Path $file)) {
        $missingFiles += $file
    }
}

if ($missingFiles.Count -gt 0) {
    Write-Host "ERROR: Missing files:" -ForegroundColor Red
    foreach ($file in $missingFiles) {
        Write-Host "  - $file" -ForegroundColor Red
    }
    Write-Host "`nAborted build. Please check file paths." -ForegroundColor Red
    exit 1
}

Write-Host "All files verified ?" -ForegroundColor Green
Write-Host "Creating package with $($filesToInclude.Count) files..." -ForegroundColor Cyan

# Create a temporary zip file
$tempZip = "temp_package.zip"
if (Test-Path $tempZip) {
    Remove-Item $tempZip
}

# Compress files
Compress-Archive -Path $filesToInclude -DestinationPath $tempZip -Force

# Rename to .mmip
Move-Item -Path $tempZip -Destination $packageName -Force

Write-Host "`nPackage created successfully!" -ForegroundColor Green
Write-Host "File: $packageName" -ForegroundColor White

# Show package details
$fileInfo = Get-Item $packageName
Write-Host "Size: $([math]::Round($fileInfo.Length / 1KB, 2)) KB" -ForegroundColor White
Write-Host "Path: $($fileInfo.FullName)" -ForegroundColor White

# Optional: Calculate SHA256 checksum
$hash = Get-FileHash -Path $packageName -Algorithm SHA256
Write-Host "`nSHA256: $($hash.Hash)" -ForegroundColor Gray
$checksumPath = Join-Path $binFolder "SimilarArtists-$version.mmip.sha256"
$hash.Hash | Out-File -FilePath $checksumPath -NoNewline

Write-Host "`n? Build complete! You can now install this package in MediaMonkey 5.0+" -ForegroundColor Green
Write-Host "  Package uses refactored modular architecture (Phases 1-7)" -ForegroundColor Gray
Write-Host "  Note: Local builds use version $version. GitHub builds use version from info.json." -ForegroundColor Yellow
