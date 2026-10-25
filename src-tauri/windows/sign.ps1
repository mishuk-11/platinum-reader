# Code-signs a Windows file (the app .exe and the setup .exe). Called by Tauri via bundle.windows.signCommand.
# Without a certificate configured it does nothing, so unsigned builds still work.
#
# Configure ONE of these (see docs/CODE-SIGNING.md):
#   CODESIGN_THUMBPRINT     certificate in the Windows certificate store (e.g. Certum SimplySign cloud certificate)
#   CODESIGN_PFX + CODESIGN_PFX_PASSWORD   a .pfx file
# Optional: CODESIGN_TIMESTAMP (default http://time.certum.pl) so signatures stay valid after the certificate expires.
param([Parameter(Mandatory)][string]$File)
$ErrorActionPreference = 'Stop'

$cert = $null
if ($env:CODESIGN_THUMBPRINT) {
  $thumb = $env:CODESIGN_THUMBPRINT -replace '\s', ''
  $cert = Get-ChildItem Cert:\CurrentUser\My, Cert:\LocalMachine\My | Where-Object Thumbprint -eq $thumb | Select-Object -First 1
  if (-not $cert) { throw "Code-signing certificate $thumb not found in the certificate store." }
} elseif ($env:CODESIGN_PFX) {
  $cert = Get-PfxCertificate -FilePath $env:CODESIGN_PFX -Password (ConvertTo-SecureString $env:CODESIGN_PFX_PASSWORD -AsPlainText -Force)
} else {
  Write-Host "sign.ps1: no certificate configured, leaving $([IO.Path]::GetFileName($File)) unsigned"
  exit 0
}

$ts = if ($env:CODESIGN_TIMESTAMP) { $env:CODESIGN_TIMESTAMP } else { 'http://time.certum.pl' }
$sig = Set-AuthenticodeSignature -FilePath $File -Certificate $cert -HashAlgorithm SHA256 -TimestampServer $ts
if ($sig.Status -ne 'Valid') { throw "Signing $File failed: $($sig.Status) $($sig.StatusMessage)" }
Write-Host "sign.ps1: signed $([IO.Path]::GetFileName($File)) as $($cert.Subject)"
