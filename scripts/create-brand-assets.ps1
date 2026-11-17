Add-Type -AssemblyName System.Drawing
$assetDirectory = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../assets/images'))
$background = [System.Drawing.ColorTranslator]::FromHtml('#F5F3EC')
$ink = [System.Drawing.ColorTranslator]::FromHtml('#365D4B')
foreach ($transparent in @($false, $true)) {
    $bitmap = New-Object System.Drawing.Bitmap 1024, 1024
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    if ($transparent) { $graphics.Clear([System.Drawing.Color]::Transparent) } else { $graphics.Clear($background) }
    $pen = New-Object System.Drawing.Pen $ink, 38
    $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
    $graphics.DrawLines($pen, [System.Drawing.PointF[]]@([System.Drawing.PointF]::new(320,708), [System.Drawing.PointF]::new(512,294), [System.Drawing.PointF]::new(704,708)))
    $graphics.DrawLine($pen, 393, 552, 631, 552)
    $finePen = New-Object System.Drawing.Pen $ink, 9
    $graphics.DrawArc($finePen, 244, 214, 536, 596, 30, 120)
    $fileName = if ($transparent) { 'arwana-foreground.png' } else { 'arwana-icon.png' }
    $bitmap.Save((Join-Path $assetDirectory $fileName), [System.Drawing.Imaging.ImageFormat]::Png)
    $finePen.Dispose()
    $pen.Dispose()
    $graphics.Dispose()
    $bitmap.Dispose()
}
