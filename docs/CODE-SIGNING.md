# Code signing: showing “Inzamam Islam” instead of “Publisher: Unknown”

Windows shows a publisher name in the admin (UAC) prompt and in SmartScreen **only** when the installer carries an Authenticode signature from a certificate that a trusted certificate authority issued to that person. Settings like `publisher` in `tauri.conf.json` only fill in *Apps → Installed apps* and file properties; they can’t change the UAC prompt.

The build is already wired for signing: `src-tauri/windows/sign.ps1` runs for the app and the setup `.exe` and uses Windows’ built-in `Set-AuthenticodeSignature`, with no Visual Studio or Windows SDK tools. With no certificate configured it skips signing, so builds always work.

## Recommended: Certum “Open Source Code Signing” certificate

It’s issued to an individual open-source developer, so Windows shows **Open Source Developer, Inzamam Islam** on every PC. It’s the cheapest trusted option for one person (tens of euros a year).

1. Order **“Open Source Code Signing in the Cloud”** at certum.store. Pick the *cloud* (SimplySign) variant; no smart card needed.
2. Complete identity verification with your ID document (Certum emails the steps). Use your real name exactly as you want it shown.
3. Install **SimplySign Desktop** and the **SimplySign** phone app, then log in. Your certificate appears in the Windows certificate store while SimplySign is connected.
4. Find its thumbprint (PowerShell):
   ```powershell
   Get-ChildItem Cert:\CurrentUser\My -CodeSigningCert | Format-List Subject, Thumbprint
   ```
5. Build with it:
   ```powershell
   $env:CODESIGN_THUMBPRINT = "<thumbprint from step 4>"
   npm run app:build
   ```
   The log shows `sign.ps1: signed platinum-reader.exe as CN=Open Source Developer, Inzamam Islam …` for the app and the installer.
6. Check: right-click the setup `.exe` → Properties → **Digital Signatures**. The UAC prompt now shows the name.

## Alternatives

| Option | Shows in UAC | Cost | Notes |
|---|---|---|---|
| Certum Open Source (above) | Open Source Developer, Inzamam Islam | low, yearly | Best fit for a solo open-source project |
| SignPath Foundation | **SignPath Foundation** (not your name) | free for qualifying open-source projects | They sign in their CI after reviewing the project |
| Standard OV code-signing (Sectigo, DigiCert, …) | Inzamam Islam | higher, yearly | Hardware token required |
| Self-signed | Unknown on other PCs | free | Only trusted on PCs where you install it yourself; not useful for users |

## SmartScreen

Even signed, a brand-new certificate may get a “Windows protected your PC” SmartScreen notice for the first downloads. It goes away on its own as the installer builds download reputation. Signing every release with the **same** certificate keeps that reputation.

## Using a .pfx file instead

```powershell
$env:CODESIGN_PFX = "C:\secure\codesign.pfx"
$env:CODESIGN_PFX_PASSWORD = "…"
npm run app:build
```
Never commit the certificate or its password.
