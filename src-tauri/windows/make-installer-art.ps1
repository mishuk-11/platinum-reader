# Draws the NSIS installer artwork (sidebar 164x314, header 150x57) as 24-bit BMPs.
# Run from src-tauri/windows:  powershell -ExecutionPolicy Bypass -File make-installer-art.ps1 -Codename Honeybee
param([string]$Codename = 'Honeybee', [string]$Version = '')
Add-Type -AssemblyName System.Drawing
$ErrorActionPreference = 'Stop'

function Tile($g, [float]$x, [float]$y, [float]$s) {
  # Rounded platinum square with "Pt" and the icy-blue dot, like the app icon.
  $r = $s * 0.22
  $path = New-Object Drawing.Drawing2D.GraphicsPath
  $d2 = $r * 2; $rx = $x + $s - $d2; $by = $y + $s - $d2
  $path.AddArc($x, $y, $d2, $d2, 180, 90); $path.AddArc($rx, $y, $d2, $d2, 270, 90)
  $path.AddArc($rx, $by, $d2, $d2, 0, 90); $path.AddArc($x, $by, $d2, $d2, 90, 90)
  $path.CloseFigure()
  $x2 = $x + $s; $y2 = $y + $s; $pen = [Math]::Max(1.5, $s * 0.025); $fs = [float]($s * 0.40)
  $fill = [Drawing.Drawing2D.LinearGradientBrush]::new([Drawing.PointF]::new($x, $y), [Drawing.PointF]::new($x2, $y2), [Drawing.Color]::FromArgb(247, 248, 250), [Drawing.Color]::FromArgb(180, 185, 193))
  $g.FillPath($fill, $path)
  $g.DrawPath([Drawing.Pen]::new([Drawing.Color]::FromArgb(124, 200, 255), $pen), $path)
  $font = [Drawing.Font]::new('Segoe UI', $fs, [Drawing.FontStyle]::Bold, [Drawing.GraphicsUnit]::Pixel)
  $fmt = New-Object Drawing.StringFormat; $fmt.Alignment = 'Center'; $fmt.LineAlignment = 'Center'
  # Precompute: in PowerShell the comma binds tighter than *, so inline math in argument lists breaks.
  $tx = $x - $s * 0.06; $ty = $y + $s * 0.02
  $g.DrawString('Pt', $font, [Drawing.SolidBrush]::new([Drawing.Color]::FromArgb(42, 47, 56)), [Drawing.RectangleF]::new($tx, $ty, $s, $s), $fmt)
  $d = $s * 0.085; $dx = $x + $s * 0.73; $dy = $y + $s * 0.58
  $g.FillEllipse([Drawing.SolidBrush]::new([Drawing.Color]::FromArgb(90, 184, 245)), $dx, $dy, $d, $d)
}

function NewCanvas($w, $h) {
  $bmp = New-Object Drawing.Bitmap($w, $h, [Drawing.Imaging.PixelFormat]::Format24bppRgb)
  $g = [Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = 'AntiAlias'; $g.TextRenderingHint = 'AntiAliasGridFit'; $g.InterpolationMode = 'HighQualityBicubic'
  return $bmp, $g
}

# Sidebar: deep graphite to slate, Pt tile, name, codename.
$bmp, $g = NewCanvas 164 314
$bg = New-Object Drawing.Drawing2D.LinearGradientBrush((New-Object Drawing.Point(0, 0)), (New-Object Drawing.Point(0, 314)), [Drawing.Color]::FromArgb(36, 41, 54), [Drawing.Color]::FromArgb(18, 21, 29))
$g.FillRectangle($bg, 0, 0, 164, 314)
$g.FillRectangle((New-Object Drawing.SolidBrush([Drawing.Color]::FromArgb(90, 184, 245))), 0, 0, 4, 314)
Tile $g 42 52 80
$white = New-Object Drawing.SolidBrush([Drawing.Color]::FromArgb(236, 239, 243))
$muted = New-Object Drawing.SolidBrush([Drawing.Color]::FromArgb(150, 160, 175))
$ice = New-Object Drawing.SolidBrush([Drawing.Color]::FromArgb(120, 196, 250))
$c = New-Object Drawing.StringFormat; $c.Alignment = 'Center'
$g.DrawString('Platinum', (New-Object Drawing.Font('Segoe UI Semibold', 17, [Drawing.GraphicsUnit]::Pixel)), $white, (New-Object Drawing.RectangleF(0, 150, 164, 24)), $c)
$g.DrawString('Reader', (New-Object Drawing.Font('Segoe UI', 17, [Drawing.GraphicsUnit]::Pixel)), $white, (New-Object Drawing.RectangleF(0, 172, 164, 24)), $c)
$g.DrawString($Codename, (New-Object Drawing.Font('Segoe UI Semibold', 12, [Drawing.GraphicsUnit]::Pixel)), $ice, (New-Object Drawing.RectangleF(0, 210, 164, 18)), $c)
if ($Version) { $g.DrawString("v$Version", (New-Object Drawing.Font('Segoe UI', 11, [Drawing.GraphicsUnit]::Pixel)), $muted, (New-Object Drawing.RectangleF(0, 228, 164, 16)), $c) }
$g.DrawString('Open source - AGPL-3.0', (New-Object Drawing.Font('Segoe UI', 10, [Drawing.GraphicsUnit]::Pixel)), $muted, (New-Object Drawing.RectangleF(0, 288, 164, 16)), $c)
$bmp.Save((Join-Path $PSScriptRoot 'installer-sidebar.bmp'), [Drawing.Imaging.ImageFormat]::Bmp)

# Header: light platinum strip with the tile on the right (NSIS draws its own title text on the left).
$bmp, $g = NewCanvas 150 57
$hb = New-Object Drawing.Drawing2D.LinearGradientBrush((New-Object Drawing.Point(0, 0)), (New-Object Drawing.Point(150, 0)), [Drawing.Color]::FromArgb(255, 255, 255), [Drawing.Color]::FromArgb(232, 236, 241))
$g.FillRectangle($hb, 0, 0, 150, 57)
Tile $g 98 8 41
$g.FillRectangle((New-Object Drawing.SolidBrush([Drawing.Color]::FromArgb(90, 184, 245))), 0, 55, 150, 2)
$bmp.Save((Join-Path $PSScriptRoot 'installer-header.bmp'), [Drawing.Imaging.ImageFormat]::Bmp)
'done'
