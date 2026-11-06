# Encodes the Kite Passport CLI login (config, agent, sessions) as base64 for Vercel sensitive env vars.
# Writes .env.kpass in the repo root (git-ignored). The owner pastes the three values into Vercel; never into chat.
$dir = Join-Path $env:USERPROFILE ".kite-passport"
$map = [ordered]@{ "KPASS_CONFIG_JSON_B64" = "config.json"; "KPASS_AGENT_JSON_B64" = "agent.json"; "KPASS_SESSIONS_JSON_B64" = "sessions.json" }
$lines = foreach ($key in $map.Keys) {
  $path = Join-Path $dir $map[$key]
  if (-not (Test-Path $path)) { throw "Missing $path. Log in with kpass first." }
  "$key=" + [Convert]::ToBase64String([IO.File]::ReadAllBytes($path))
}
$out = Join-Path (Split-Path $PSScriptRoot -Parent) ".env.kpass"
Set-Content -Path $out -Value $lines -Encoding ascii
Write-Host "Wrote $out with $($map.Count) variables. Paste each into Vercel (Project tendr > Settings > Environment Variables, Sensitive, Production and Preview), then delete the file."
