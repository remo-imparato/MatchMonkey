<#
Simple helper to tag and push a release tag.
Usage:
  .\tag-release.ps1 2.0.2
or
  .\tag-release.ps1 v2.0.2

This will run:
  git tag -a v2.0.2 -m "Release Match Monkey v2.0.2"
  git push origin v2.0.2
#>

param(
    [Parameter(Mandatory=$true, Position=0)]
    [string]$Version
)

function Normalize-Tag([string]$v) {
    if ($v -match '^v') { return $v }
    else { return "v$v" }
}

try {
    $tag = Normalize-Tag $Version

    Write-Host "Tag to create: $tag" -ForegroundColor Cyan

    # Check git availability
    $git = Get-Command git -ErrorAction SilentlyContinue
    if (-not $git) {
        Write-Error "git is not available in PATH. Install git and retry."
        exit 2
    }

    # Confirm
    $confirm = Read-Host "Create annotated tag $tag and push to origin? (y/n)"
    if ($confirm.ToLower() -ne 'y') {
        Write-Host "Aborted by user." -ForegroundColor Yellow
        exit 0
    }

    # Create annotated tag
    $msg = "Release Match Monkey $tag"
    Write-Host "Running: git tag -a $tag -m "$msg"" -ForegroundColor Gray
    git tag -a $tag -m "$msg"
    if ($LASTEXITCODE -ne 0) { Write-Error "Failed to create tag $tag"; exit $LASTEXITCODE }

    # Push tag
    Write-Host "Pushing tag to origin: git push origin $tag" -ForegroundColor Gray
    git push origin $tag
    if ($LASTEXITCODE -ne 0) { Write-Error "Failed to push tag $tag"; exit $LASTEXITCODE }

    Write-Host "Success: tag $tag created and pushed." -ForegroundColor Green
    exit 0

} catch {
    Write-Error "Error: $_"
    exit 1
}
