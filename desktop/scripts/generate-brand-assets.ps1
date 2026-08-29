param(
  [string]$Source = "src/assets/sonveil-app-icon.svg"
)

$ErrorActionPreference = "Stop"

if ([System.IO.Path]::GetExtension($Source) -eq ".svg") {
  $projectRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path
  $sourcePath = (Resolve-Path -LiteralPath (Join-Path $projectRoot $Source)).Path
  $iconsPath = Join-Path $projectRoot "src-tauri/icons"
  $tauriCli = Join-Path $projectRoot "node_modules/@tauri-apps/cli/tauri.js"
  $nodeCommand = Get-Command node -ErrorAction Stop

  if (-not (Test-Path -LiteralPath $tauriCli)) {
    throw "Tauri CLI is not installed. Install workspace dependencies before generating icons."
  }

  Push-Location $projectRoot
  try {
    # Generate PNG, Windows ICO/AppX tiles, macOS ICNS, iOS and Android assets.
    & $nodeCommand.Source $tauriCli icon $sourcePath --output $iconsPath
    if ($LASTEXITCODE -ne 0) {
      throw "Tauri icon generation failed with exit code $LASTEXITCODE."
    }

    # Tauri's default icon.png is 512px. Keep an explicit 1024px PNG master too.
    & $nodeCommand.Source $tauriCli icon $sourcePath --output $iconsPath --png 1024
    if ($LASTEXITCODE -ne 0) {
      throw "1024px icon generation failed with exit code $LASTEXITCODE."
    }

    Copy-Item -LiteralPath (Join-Path $iconsPath "1024x1024.png") -Destination "src/assets/sonveil-app-icon.png" -Force
    Copy-Item -LiteralPath (Join-Path $iconsPath "128x128.png") -Destination "src/assets/app-icon.png" -Force
    Copy-Item -LiteralPath (Join-Path $iconsPath "icon.png") -Destination "src/assets/app-icon@2x.png" -Force
    Copy-Item -LiteralPath (Join-Path $iconsPath "128x128.png") -Destination "src/assets/sc-logo.png" -Force
  } finally {
    Pop-Location
  }

  Write-Output "Generated Sonveil brand assets from $sourcePath"
  return
}

Add-Type -AssemblyName System.Drawing

function New-Canvas([int]$Size) {
  $bitmap = [System.Drawing.Bitmap]::new(
    $Size,
    $Size,
    [System.Drawing.Imaging.PixelFormat]::Format32bppArgb
  )
  $bitmap.SetResolution(96, 96)
  return $bitmap
}

function Save-ResizedSquare(
  [System.Drawing.Bitmap]$SourceBitmap,
  [System.Drawing.Rectangle]$SourceRectangle,
  [int]$Size,
  [string]$Destination
) {
  $bitmap = New-Canvas $Size
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  try {
    $graphics.Clear([System.Drawing.Color]::Transparent)
    $graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
    $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $graphics.DrawImage(
      $SourceBitmap,
      [System.Drawing.Rectangle]::new(0, 0, $Size, $Size),
      $SourceRectangle,
      [System.Drawing.GraphicsUnit]::Pixel
    )
  } finally {
    $graphics.Dispose()
  }

  $destinationPath = [System.IO.Path]::GetFullPath($Destination)
  [System.IO.Directory]::CreateDirectory([System.IO.Path]::GetDirectoryName($destinationPath)) | Out-Null
  $bitmap.Save($destinationPath, [System.Drawing.Imaging.ImageFormat]::Png)
  $bitmap.Dispose()
}

function New-ResizedSquareBytes(
  [System.Drawing.Bitmap]$SourceBitmap,
  [System.Drawing.Rectangle]$SourceRectangle,
  [int]$Size
) {
  $bitmap = New-Canvas $Size
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  try {
    $graphics.Clear([System.Drawing.Color]::Transparent)
    $graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
    $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $graphics.DrawImage(
      $SourceBitmap,
      [System.Drawing.Rectangle]::new(0, 0, $Size, $Size),
      $SourceRectangle,
      [System.Drawing.GraphicsUnit]::Pixel
    )
  } finally {
    $graphics.Dispose()
  }

  $memory = [System.IO.MemoryStream]::new()
  try {
    $bitmap.Save($memory, [System.Drawing.Imaging.ImageFormat]::Png)
    return $memory.ToArray()
  } finally {
    $memory.Dispose()
    $bitmap.Dispose()
  }
}

function Save-WindowsIcon(
  [System.Drawing.Bitmap]$SourceBitmap,
  [System.Drawing.Rectangle]$SourceRectangle,
  [string]$Destination
) {
  $entries = [System.Collections.Generic.List[object]]::new()
  foreach ($size in @(16, 24, 32, 48, 64, 128, 256)) {
    $entries.Add([pscustomobject]@{
      Size = $size
      Bytes = New-ResizedSquareBytes $SourceBitmap $SourceRectangle $size
    })
  }

  $destinationPath = [System.IO.Path]::GetFullPath($Destination)
  [System.IO.Directory]::CreateDirectory([System.IO.Path]::GetDirectoryName($destinationPath)) | Out-Null
  $stream = [System.IO.File]::Open($destinationPath, [System.IO.FileMode]::Create)
  $writer = [System.IO.BinaryWriter]::new($stream)
  try {
    $writer.Write([uint16]0)
    $writer.Write([uint16]1)
    $writer.Write([uint16]$entries.Count)

    $offset = 6 + (16 * $entries.Count)
    foreach ($entry in $entries) {
      $encodedSize = if ($entry.Size -eq 256) { 0 } else { $entry.Size }
      $writer.Write([byte]$encodedSize)
      $writer.Write([byte]$encodedSize)
      $writer.Write([byte]0)
      $writer.Write([byte]0)
      $writer.Write([uint16]1)
      $writer.Write([uint16]32)
      $writer.Write([uint32]$entry.Bytes.Length)
      $writer.Write([uint32]$offset)
      $offset += $entry.Bytes.Length
    }

    foreach ($entry in $entries) {
      $writer.Write([byte[]]$entry.Bytes)
    }
  } finally {
    $writer.Dispose()
    $stream.Dispose()
  }
}

function Find-VisibleBounds([System.Drawing.Bitmap]$Bitmap) {
  $left = $Bitmap.Width
  $top = $Bitmap.Height
  $right = -1
  $bottom = -1

  for ($y = 0; $y -lt $Bitmap.Height; $y++) {
    for ($x = 0; $x -lt $Bitmap.Width; $x++) {
      if ($Bitmap.GetPixel($x, $y).A -le 8) {
        continue
      }

      if ($x -lt $left) { $left = $x }
      if ($x -gt $right) { $right = $x }
      if ($y -lt $top) { $top = $y }
      if ($y -gt $bottom) { $bottom = $y }
    }
  }

  if ($right -lt $left -or $bottom -lt $top) {
    throw "The logo source contains no visible pixels."
  }

  $contentSize = [Math]::Max($right - $left + 1, $bottom - $top + 1)
  # Windows visually adds its own breathing room around taskbar/start-menu
  # icons. Keep only a narrow safety edge in the source so the mark does not
  # look undersized after the shell applies that treatment.
  $padding = [Math]::Ceiling($contentSize * 0.035)
  $squareSize = [Math]::Min(
    [Math]::Max($contentSize + (2 * $padding), 1),
    [Math]::Min($Bitmap.Width, $Bitmap.Height)
  )
  $centerX = ($left + $right) / 2
  $centerY = ($top + $bottom) / 2
  $x = [Math]::Max(0, [Math]::Min($Bitmap.Width - $squareSize, [Math]::Round($centerX - ($squareSize / 2))))
  $y = [Math]::Max(0, [Math]::Min($Bitmap.Height - $squareSize, [Math]::Round($centerY - ($squareSize / 2))))

  return [System.Drawing.Rectangle]::new($x, $y, $squareSize, $squareSize)
}

function New-CoralMark([System.Drawing.Bitmap]$Bitmap) {
  $mark = New-Canvas $Bitmap.Width
  if ($Bitmap.Height -ne $Bitmap.Width) {
    $mark.Dispose()
    $mark = [System.Drawing.Bitmap]::new(
      $Bitmap.Width,
      $Bitmap.Height,
      [System.Drawing.Imaging.PixelFormat]::Format32bppArgb
    )
  }

  for ($y = 0; $y -lt $Bitmap.Height; $y++) {
    for ($x = 0; $x -lt $Bitmap.Width; $x++) {
      $pixel = $Bitmap.GetPixel($x, $y)
      $darkestOtherChannel = [Math]::Max($pixel.G, $pixel.B)
      $isCoral = $pixel.A -gt 8 -and $pixel.R -ge 54 -and ($pixel.R - $darkestOtherChannel) -ge 24

      if ($isCoral) {
        $mark.SetPixel($x, $y, $pixel)
      }
    }
  }

  return $mark
}

$sourcePath = (Resolve-Path -LiteralPath $Source).Path
$sourceBitmap = [System.Drawing.Bitmap]::FromFile($sourcePath)

try {
  $bounds = Find-VisibleBounds $sourceBitmap
  $coralMark = New-CoralMark $sourceBitmap
  try {
    Save-ResizedSquare $sourceBitmap $bounds 1024 "src/assets/sonveil-app-icon.png"
    Save-ResizedSquare $coralMark $bounds 512 "src/assets/app-icon@2x.png"
    Save-ResizedSquare $coralMark $bounds 128 "src/assets/app-icon.png"

    $tauriPngs = @{
      "src-tauri/icons/32x32.png" = 32
      "src-tauri/icons/64x64.png" = 64
      "src-tauri/icons/128x128.png" = 128
      "src-tauri/icons/128x128@2x.png" = 256
      "src-tauri/icons/icon.png" = 512
      "src-tauri/icons/Square30x30Logo.png" = 30
      "src-tauri/icons/Square44x44Logo.png" = 44
      "src-tauri/icons/StoreLogo.png" = 50
      "src-tauri/icons/Square71x71Logo.png" = 71
      "src-tauri/icons/Square89x89Logo.png" = 89
      "src-tauri/icons/Square107x107Logo.png" = 107
      "src-tauri/icons/Square142x142Logo.png" = 142
      "src-tauri/icons/Square150x150Logo.png" = 150
      "src-tauri/icons/Square284x284Logo.png" = 284
      "src-tauri/icons/Square310x310Logo.png" = 310
    }
    foreach ($entry in $tauriPngs.GetEnumerator()) {
      Save-ResizedSquare $sourceBitmap $bounds $entry.Value $entry.Key
    }
    Save-WindowsIcon $sourceBitmap $bounds "src-tauri/icons/icon.ico"
  } finally {
    $coralMark.Dispose()
  }
} finally {
  $sourceBitmap.Dispose()
}

Write-Output "Generated Sonveil brand assets from $Source"
