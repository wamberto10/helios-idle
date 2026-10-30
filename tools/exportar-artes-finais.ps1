# Exporta as artes novas em tamanhos de interface; preserva os PNGs gerados, sem recorte.
# Execute da raiz do projeto: powershell -File tools/exportar-artes-finais.ps1
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$originalRoot = Join-Path $projectRoot 'artifacts\artes-finais-originais'
$exports = @(
    @{ Dir='assets\achievements'; Size=192 },
    @{ Dir='assets\research'; Size=160 },
    @{ Dir='assets\universes'; Size=960 },
    @{ File='assets\ships\freighter.png'; Size=384 },
    @{ File='assets\ships\probe.png'; Size=384 },
    @{ File='assets\resources\icons\energy.png'; Size=128 },
    @{ File='assets\ui\logo.png'; Size=128 },
    @{ File='assets\ui\anomaly.png'; Size=1100 }
)
function Export-InterfaceImage([string]$sourceFile, [string]$destinationFile, [int]$maxSize) {
    $sourceImage = [Drawing.Image]::FromFile($sourceFile)
    try {
        $scale = [Math]::Min([double]1, $maxSize / [double][Math]::Max($sourceImage.Width,$sourceImage.Height))
        $width = [int][Math]::Round($sourceImage.Width*$scale)
        $height = [int][Math]::Round($sourceImage.Height*$scale)
        $bitmap = [Drawing.Bitmap]::new($width,$height,[Drawing.Imaging.PixelFormat]::Format32bppArgb)
        $graphics = [Drawing.Graphics]::FromImage($bitmap)
        $imageAttributes = [Drawing.Imaging.ImageAttributes]::new()
        try {
            $graphics.CompositingMode = [Drawing.Drawing2D.CompositingMode]::SourceCopy
            $graphics.CompositingQuality = [Drawing.Drawing2D.CompositingQuality]::HighQuality
            $graphics.InterpolationMode = [Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
            $graphics.PixelOffsetMode = [Drawing.Drawing2D.PixelOffsetMode]::HighQuality
            $imageAttributes.SetWrapMode([Drawing.Drawing2D.WrapMode]::TileFlipXY)
            $graphics.DrawImage($sourceImage,[Drawing.Rectangle]::new(0,0,$width,$height),0,0,$sourceImage.Width,$sourceImage.Height,[Drawing.GraphicsUnit]::Pixel,$imageAttributes)
            $bitmap.Save($destinationFile,[Drawing.Imaging.ImageFormat]::Png)
        } finally { $imageAttributes.Dispose(); $graphics.Dispose(); $bitmap.Dispose() }
    } finally { $sourceImage.Dispose() }
}
$exportedCount = 0
foreach($export in $exports) {
    $relativeFiles = if($export.File) { @($export.File) } else {
        @(Get-ChildItem -LiteralPath (Join-Path $projectRoot $export.Dir) -Filter '*.png' | ForEach-Object { Join-Path $export.Dir $_.Name })
    }
    foreach($relativeFile in $relativeFiles) {
        $destinationFile = Join-Path $projectRoot $relativeFile
        $sourceFile = Join-Path $originalRoot $relativeFile
        if(-not (Test-Path -LiteralPath $sourceFile)) {
            [IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($sourceFile)) | Out-Null
            Copy-Item -LiteralPath $destinationFile -Destination $sourceFile
        }
        Export-InterfaceImage $sourceFile $destinationFile $export.Size
        $exportedCount++
    }
}
Export-InterfaceImage (Join-Path $originalRoot 'assets\ui\logo.png') (Join-Path $projectRoot 'assets\ui\favicon.png') 64
Write-Output "$exportedCount artes exportadas + favicon; originais em artifacts/artes-finais-originais."
