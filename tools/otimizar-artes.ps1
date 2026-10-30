# Gera as cópias de interface das artes grandes (instalações, retratos, comandantes e regiões).
# O PNG original vai para artifacts/artes-finais-originais (fica só no computador, fora do git) e o jogo
# passa a usar uma cópia no tamanho em que a arte aparece na tela. Fotos opacas viram JPG; artes com
# transparência continuam PNG. Pode rodar de novo: sempre parte do original guardado.
# Execute da raiz do projeto: powershell -File tools/otimizar-artes.ps1
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$originalRoot = Join-Path $projectRoot 'artifacts\artes-finais-originais'
# Size = maior lado em pixels (cerca de 2x o maior tamanho na tela). Format = png (transparência) ou jpg (foto opaca).
$groups = @(
    @{ Dir='assets\buildings';  Size=256;  Format='png' },
    @{ Dir='assets\portraits';  Size=512;  Format='jpg' },
    @{ Dir='assets\commanders'; Size=640;  Format='jpg' },
    @{ Dir='assets\regions';    Size=1600; Format='jpg'; Wide=2400 }  # terrenos rolam na horizontal: mais largura
)
$jpgCodec = [Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
$jpgParams = [Drawing.Imaging.EncoderParameters]::new(1)
$jpgParams.Param[0] = [Drawing.Imaging.EncoderParameter]::new([Drawing.Imaging.Encoder]::Quality, [long]86)

function Export-Art([string]$src, [string]$dst, [int]$maxSize, [string]$format) {
    $img = [Drawing.Image]::FromFile($src)
    try {
        $scale = [Math]::Min([double]1, $maxSize / [double][Math]::Max($img.Width, $img.Height))
        $w = [int][Math]::Round($img.Width * $scale); $h = [int][Math]::Round($img.Height * $scale)
        $pf = if ($format -eq 'png') { [Drawing.Imaging.PixelFormat]::Format32bppArgb } else { [Drawing.Imaging.PixelFormat]::Format24bppRgb }
        $bmp = [Drawing.Bitmap]::new($w, $h, $pf)
        $g = [Drawing.Graphics]::FromImage($bmp); $attr = [Drawing.Imaging.ImageAttributes]::new()
        try {
            $g.CompositingQuality = [Drawing.Drawing2D.CompositingQuality]::HighQuality
            $g.InterpolationMode = [Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
            $g.PixelOffsetMode = [Drawing.Drawing2D.PixelOffsetMode]::HighQuality
            if ($format -eq 'png') { $g.CompositingMode = [Drawing.Drawing2D.CompositingMode]::SourceCopy }
            $attr.SetWrapMode([Drawing.Drawing2D.WrapMode]::TileFlipXY)
            $g.DrawImage($img, [Drawing.Rectangle]::new(0, 0, $w, $h), 0, 0, $img.Width, $img.Height, [Drawing.GraphicsUnit]::Pixel, $attr)
            if ($format -eq 'png') { $bmp.Save($dst, [Drawing.Imaging.ImageFormat]::Png) } else { $bmp.Save($dst, $jpgCodec, $jpgParams) }
        } finally { $attr.Dispose(); $g.Dispose(); $bmp.Dispose() }
    } finally { $img.Dispose() }
}

$before = 0; $after = 0; $count = 0
foreach ($grp in $groups) {
    $origDir = Join-Path $originalRoot $grp.Dir
    [IO.Directory]::CreateDirectory($origDir) | Out-Null
    # guarda no lugar dos originais todo PNG ainda não guardado (primeira execução)
    foreach ($f in Get-ChildItem -LiteralPath (Join-Path $projectRoot $grp.Dir) -Filter '*.png') {
        $orig = Join-Path $origDir $f.Name
        if (-not (Test-Path -LiteralPath $orig)) { Copy-Item -LiteralPath $f.FullName -Destination $orig }
    }
    foreach ($o in Get-ChildItem -LiteralPath $origDir -Filter '*.png') {
        $base = [IO.Path]::GetFileNameWithoutExtension($o.Name)
        $size = if ($grp.Wide -and $base -like '*-terreno') { $grp.Wide } else { $grp.Size }
        $dst = Join-Path (Join-Path $projectRoot $grp.Dir) ($base + '.' + $grp.Format)
        Export-Art $o.FullName $dst $size $grp.Format
        if ($grp.Format -ne 'png') { $old = Join-Path (Join-Path $projectRoot $grp.Dir) $o.Name; if (Test-Path -LiteralPath $old) { Remove-Item -LiteralPath $old } }
        $before += $o.Length; $after += (Get-Item -LiteralPath $dst).Length; $count++
    }
}
Write-Output ("{0} artes: {1:N1} MB -> {2:N1} MB (originais em artifacts/artes-finais-originais)." -f $count, ($before / 1MB), ($after / 1MB))
