Add-Type -AssemblyName System.Drawing
$img = [System.Drawing.Bitmap]::new("c:\Users\taydaws\OneDrive - amazon.com\Desktop\Kiro\Zestorium\zestorium\public\bottle.png")

$width = $img.Width
$height = $img.Height

# Sample every N rows to keep the polygon manageable
$step = [math]::Floor($height / 80)
$leftEdges = @()
$rightEdges = @()

for ($y = 0; $y -lt $height; $y += $step) {
    $leftFound = $false
    $left = 0
    $right = 0

    # Scan from left
    for ($x = 0; $x -lt $width; $x++) {
        $pixel = $img.GetPixel($x, $y)
        if ($pixel.A -gt 30) {
            $left = $x
            $leftFound = $true
            break
        }
    }

    # Scan from right
    for ($x = $width - 1; $x -ge 0; $x--) {
        $pixel = $img.GetPixel($x, $y)
        if ($pixel.A -gt 30) {
            $right = $x
            break
        }
    }

    if ($leftFound) {
        # Convert to percentages
        $leftPct = [math]::Round(($left / $width) * 100, 2)
        $rightPct = [math]::Round(($right / $width) * 100, 2)
        $yPct = [math]::Round(($y / $height) * 100, 2)
        $leftEdges += "$leftPct% $yPct%"
        $rightEdges += "$rightPct% $yPct%"
    }
}

$img.Dispose()

# Build polygon: left edges top-to-bottom, then right edges bottom-to-top
[array]::Reverse($rightEdges)
$allPoints = $leftEdges + $rightEdges
$polygon = $allPoints -join ", "

Write-Host "polygon($polygon)"
