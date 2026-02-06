param(
    [string[]]$models
)

$baseUrlTemplate = "https://cdn.jsdelivr.net/npm/live2d-widget-model-{0}@latest/assets"
$targetBase = "assets/models"

foreach ($model in $models) {
    Write-Host "Processing model: $model"
    $modelDir = Join-Path $targetBase $model
    if (-not (Test-Path $modelDir)) {
        New-Item -ItemType Directory -Force -Path $modelDir | Out-Null
    }

    $urlModelName = $model.ToLower()
    $baseUrl = $baseUrlTemplate -f $urlModelName
    $jsonUrl = "$baseUrl/$model.model.json"
    $localJsonPath = Join-Path $modelDir "$model.model.json"

    try {
        # Download model.json
        Write-Host "  Downloading config: $jsonUrl"
        Invoke-WebRequest -Uri $jsonUrl -OutFile $localJsonPath
        
        # Parse JSON
        $jsonContent = Get-Content $localJsonPath -Raw | ConvertFrom-Json
        
        # Collect all files to download
        $filesToDownload = @()
        
        # 1. Main Model
        if ($jsonContent.model) { $filesToDownload += $jsonContent.model }
        
        # 2. Textures
        if ($jsonContent.textures) { $filesToDownload += $jsonContent.textures }
        
        # 3. Physics
        if ($jsonContent.physics) { $filesToDownload += $jsonContent.physics }
        
        # 4. Pose
        if ($jsonContent.pose) { $filesToDownload += $jsonContent.pose }
        
        # 5. Expressions
        if ($jsonContent.expressions) {
            foreach ($exp in $jsonContent.expressions) {
                if ($exp.file) { $filesToDownload += $exp.file }
            }
        }
        
        # 6. Motions
        if ($jsonContent.motions) {
            $groups = $jsonContent.motions | Get-Member -MemberType NoteProperty | Select-Object -ExpandProperty Name
            foreach ($group in $groups) {
                $motions = $jsonContent.motions.$group
                foreach ($motion in $motions) {
                     if ($motion.file) { $filesToDownload += $motion.file }
                     if ($motion.sound) { $filesToDownload += $motion.sound }
                }
            }
        }

        # Download each file
        foreach ($fileRelPath in $filesToDownload) {
            $fileUrl = "$baseUrl/$fileRelPath"
            $localFilePath = Join-Path $modelDir $fileRelPath
            $localFileDir = Split-Path $localFilePath
            
            if (-not (Test-Path $localFileDir)) {
                New-Item -ItemType Directory -Force -Path $localFileDir | Out-Null
            }
            
            Write-Host "  Asset: $fileRelPath"
            try {
                Invoke-WebRequest -Uri $fileUrl -OutFile $localFilePath
            } catch {
                Write-Warning "Failed to download $fileUrl : $_"
            }
        }
        
    } catch {
        Write-Error "Failed to process $model : $_"
    }
    Write-Host "  Done."
}
