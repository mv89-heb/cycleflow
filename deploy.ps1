$repoPath = Get-Location

if (-not (Test-Path (Join-Path $repoPath ".git"))) {
    Write-Host "❌ Not a git repository"
    exit
}

Write-Host "🚀 Deploy starting..."

git -C $repoPath add .
git -C $repoPath commit -m "auto deploy"
git -C $repoPath push origin main

Write-Host "✅ Done"