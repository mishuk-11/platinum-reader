# Pixelates private areas (file paths with the user name, pinned folders) in the manual screenshots
# and trims the window's invisible resize border, which captures whatever is behind the window.
# Run once after capturing new screenshots:  powershell -ExecutionPolicy Bypass -File docs\manual\redact.ps1
Add-Type -AssemblyName System.Drawing
$img = Join-Path $PSScriptRoot 'img'

function Pixelate([Drawing.Bitmap]$bmp, [int]$x, [int]$y, [int]$w, [int]$h, [int]$block = 9) {
  $w = [Math]::Min($w, $bmp.Width - $x); $h = [Math]::Min($h, $bmp.Height - $y)
  $sw = [Math]::Max(1, [int]($w / $block)); $sh = [Math]::Max(1, [int]($h / $block))
  $small = New-Object Drawing.Bitmap($sw, $sh)
  $g = [Drawing.Graphics]::FromImage($small)
  $g.InterpolationMode = 'HighQualityBilinear'
  $g.DrawImage($bmp, [Drawing.Rectangle]::new(0, 0, $sw, $sh), [Drawing.Rectangle]::new($x, $y, $w, $h), 'Pixel')
  $g.Dispose()
  $g = [Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = 'NearestNeighbor'; $g.PixelOffsetMode = 'Half'
  $g.DrawImage($small, [Drawing.Rectangle]::new($x, $y, $w, $h), [Drawing.Rectangle]::new(0, 0, $sw, $sh), 'Pixel')
  $g.Dispose(); $small.Dispose()
}

function Edit($name, [scriptblock]$fn, [switch]$Trim, [int[]]$Crop) {
  $path = Join-Path $img $name
  $src = [Drawing.Bitmap]::FromFile($path)
  $bmp = New-Object Drawing.Bitmap($src)   # copy, so the file isn't locked while saving
  $src.Dispose()
  & $fn $bmp
  if ($Crop) {
    # x, y, width, height; only applied to an uncropped capture of the expected size.
    if ($bmp.Width -ge $Crop[0] + $Crop[2] -and $bmp.Height -ge $Crop[1] + $Crop[3]) {
      $out = $bmp.Clone([Drawing.Rectangle]::new($Crop[0], $Crop[1], $Crop[2], $Crop[3]), $bmp.PixelFormat)
      $bmp.Dispose(); $bmp = $out
    }
  }
  if ($Trim -and $bmp.Width -eq 1280) {
    # 8 px invisible border on the left, right and bottom of a 1280x820 window capture.
    $out = $bmp.Clone([Drawing.Rectangle]::new(8, 0, 1264, 812), $bmp.PixelFormat)
    $bmp.Dispose(); $bmp = $out
  }
  $bmp.Save($path, [Drawing.Imaging.ImageFormat]::Png); $bmp.Dispose()
  "redacted $name"
}

# Home: the path line under each recent file.
Edit '01-home.png' { param($b) foreach ($y in 375, 427, 479) { Pixelate $b 355 $y 515 19 } } -Trim
# Tab menu: the file-path tooltip.
Edit '06-tab-menu.png' { param($b) Pixelate $b 264 35 816 32 } -Trim
# Explorer (900x700 capture): crop off the address bar (user folder) and the navigation pane (pinned folders).
Edit '12-explorer-hold.png' { param($b) } -Crop 170, 30, 730, 670
# Every other app window capture: just trim the border.
foreach ($n in '02-reading.png', '03-find.png', '04-selection-menu.png', '05-highlights-unsaved.png', '06b-split-view.png',
               '07-settings.png', '08-help.png', '09-self-test.png', '10-about.png', '11-feedback.png') {
  Edit $n { param($b) } -Trim
}

