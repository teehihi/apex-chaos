const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const latestHtmlPath = path.join(root, 'apex_chaos_musician_visuals.html');
const soloBackupPath = path.join(root, 'public', 'apexEngine.before_musician_main_with_solo.js');
const outputPath = path.join(root, 'public', 'apexEngine.js');

const html = fs.readFileSync(latestHtmlPath, 'utf8');
const scriptStart = html.indexOf('<script>');
const scriptEnd = html.lastIndexOf('</script>');
if (scriptStart < 0 || scriptEnd <= scriptStart) {
  throw new Error('Could not find standalone <script> content.');
}

const latestScript = html.slice(scriptStart + '<script>'.length, scriptEnd).trimEnd();
const oldEngine = fs.readFileSync(soloBackupPath, 'utf8');

const soloStartMarker = 'let soloShake=0; const soloKeys={}, soloPrev={};';
const soloEndMarker = "    window.apexCorrectivePatch3='ready';";
const soloStart = oldEngine.indexOf(soloStartMarker);
const soloEnd = oldEngine.indexOf(soloEndMarker, soloStart);
if (soloStart < 0 || soloEnd < 0) {
  throw new Error('Could not find Solo 1V1 restore markers in old deploy engine.');
}

const soloBody = oldEngine.slice(soloStart, soloEnd).trimEnd();
const soloRestorePatch = `

// ===== SOLO 1V1 LOCAL RESTORE: deploy keeps current manual mode while auto battle stays from latest standalone =====
(function apexSolo1v1RestorePatch(){
  if (window.apexSolo1v1RestorePatch === 'ready') return;
  const FT = name => FighterTypes.find(t => t.name === name);
  function resetCtx(c){
    c.globalAlpha = 1;
    c.globalCompositeOperation = 'source-over';
    c.shadowBlur = 0;
    c.shadowColor = 'transparent';
    c.shadowOffsetX = 0;
    c.shadowOffsetY = 0;
    c.filter = 'none';
    c.setLineDash([]);
    c.lineCap = 'butt';
    c.lineJoin = 'miter';
  }
${soloBody}
  window.apexSolo1v1RestorePatch = 'ready';
})();
`;

fs.writeFileSync(outputPath, `${latestScript}${soloRestorePatch}`, 'utf8');

console.log(JSON.stringify({
  output: outputPath,
  latestScriptLength: latestScript.length,
  soloRestoreLength: soloBody.length,
  totalLength: latestScript.length + soloRestorePatch.length,
}, null, 2));
