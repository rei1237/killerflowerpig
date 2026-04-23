Add-Type -AssemblyName System.Drawing
$img = [System.Drawing.Image]::FromFile("C:\Users\Neo\CascadeProjects\zombie killer flower pig\asset\청토끼.png")
Write-Host "Width: $($img.Width)"
Write-Host "Height: $($img.Height)"
$img.Dispose()
