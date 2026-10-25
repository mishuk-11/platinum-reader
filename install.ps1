# Platinum Reader installer for Windows.
#   irm https://raw.githubusercontent.com/mishuk-11/platinum-reader/main/install.ps1 | iex
# Downloads the newest release from GitHub, verifies its SHA-256 checksum, then runs the setup
# (which asks: install just for you, or for all users in Program Files).
$ErrorActionPreference = 'Stop'
$repo = 'mishuk-11/platinum-reader'

$release = Invoke-RestMethod "https://api.github.com/repos/$repo/releases?per_page=15" |
  Where-Object { -not $_.draft } | Select-Object -First 1
if (-not $release) { throw "No release found at github.com/$repo" }
$setup = $release.assets | Where-Object { $_.name -like '*x64-setup.exe' } | Select-Object -First 1
$sums = $release.assets | Where-Object { $_.name -match '^SHA256SUMS' } | Select-Object -First 1
if (-not $setup -or -not $sums) { throw "Release $($release.tag_name) has no Windows installer or checksum file" }

$dir = Join-Path $env:TEMP 'platinum-reader-install'
New-Item -ItemType Directory -Force $dir | Out-Null
$exe = Join-Path $dir $setup.name
$sumFile = Join-Path $dir $sums.name

Write-Host "Downloading Platinum Reader $($release.tag_name) ($([math]::Round($setup.size / 1MB, 1)) MB)..."
Invoke-WebRequest $setup.browser_download_url -OutFile $exe -UseBasicParsing
Invoke-WebRequest $sums.browser_download_url -OutFile $sumFile -UseBasicParsing

$expected = (Get-Content $sumFile | Where-Object { $_ -match [regex]::Escape($setup.name) } | Select-Object -First 1) -split '\s+' | Select-Object -First 1
$actual = (Get-FileHash $exe -Algorithm SHA256).Hash
if (-not $expected -or $expected -ne $actual) { Remove-Item $exe; throw 'Checksum mismatch: download deleted, nothing was installed.' }

Write-Host 'Checksum OK. Starting the installer...'
Start-Process $exe -Wait
Write-Host 'Done.'
