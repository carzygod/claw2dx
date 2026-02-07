$models = @(
    @{ Name = 'Koharu'; Path = 'assets/models/koharu/koharu.model.json' },
    @{ Name = 'Shizuku'; Path = 'assets/models/shizuku/shizuku.model.json' },
    @{ Name = 'Wanko'; Path = 'assets/models/wanko/wanko.model.json' },
    @{ Name = 'Haru02'; Path = 'assets/models/haru02/haru02.model.json' },
    @{ Name = 'Izumi'; Path = 'assets/models/izumi/izumi.model.json' },
    @{ Name = 'Pio'; Path = 'assets/models/Potion-Maker/Pio/index.json' },
    @{ Name = 'Tia'; Path = 'assets/models/Potion-Maker/Tia/index.json' },
    @{ Name = '22 (Bilibili)'; Path = 'assets/models/bilibili-live/22/index.json' },
    @{ Name = '33 (Bilibili)'; Path = 'assets/models/bilibili-live/33/index.json' },
    @{ Name = 'Shizuku 48'; Path = 'assets/models/ShizukuTalk/shizuku-48/index.json' },
    @{ Name = 'Shizuku Pajama'; Path = 'assets/models/ShizukuTalk/shizuku-pajama/index.json' },
    @{ Name = 'Neptune Classic'; Path = 'assets/models/HyperdimensionNeptunia/neptune_classic/index.json' },
    @{ Name = 'NepNep'; Path = 'assets/models/HyperdimensionNeptunia/nepnep/index.json' },
    @{ Name = 'Neptune Santa'; Path = 'assets/models/HyperdimensionNeptunia/neptune_santa/index.json' },
    @{ Name = 'NepMaid'; Path = 'assets/models/HyperdimensionNeptunia/nepmaid/index.json' },
    @{ Name = 'NepSwim'; Path = 'assets/models/HyperdimensionNeptunia/nepswim/index.json' },
    @{ Name = 'Murakumo'; Path = 'assets/models/KantaiCollection/murakumo/index.json' }
)

$output = @()

foreach ($m in $models) {
    if (Test-Path $m.Path) {
        $jsonContent = Get-Content $m.Path -Raw | ConvertFrom-Json
        
        # Convert list to tagged hashtable
        $expressionsObj = @{}
        $exprIndex = 0
        if ($jsonContent.expressions) {
            $exprList = @()
            if ($jsonContent.expressions -is [System.Array]) {
                $exprList = $jsonContent.expressions | ForEach-Object { $_.name }
            }
            elseif ($jsonContent.expressions -is [System.Management.Automation.PSCustomObject]) {
                $exprList = $jsonContent.expressions.PSObject.Properties.Name
            }
            
            foreach ($exp in $exprList) {
                $expressionsObj["tag_$exprIndex"] = $exp
                $exprIndex++
            }
        }

        $motionsObj = @{}
        $motionIndex = 0
        
        # Check standard 'motions' object
        if ($jsonContent.motions) {
            $motionList = $jsonContent.motions.PSObject.Properties.Name
            foreach ($mot in $motionList) {
                $motionsObj["tag_$motionIndex"] = $mot
                $motionIndex++
            }
        } 

        $output += @{
            name        = $m.Name
            path        = $m.Path
            expressions = $expressionsObj
            motions     = $motionsObj
        }
    }
    else {
        Write-Host "Warning: Model file not found: $($m.Path)"
    }
}

$output | ConvertTo-Json -Depth 4 | Set-Content "models.json"
Write-Host "Generated models.json with $($output.Count) models."
