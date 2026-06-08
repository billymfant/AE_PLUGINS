'use strict';

const { execSync } = require('child_process');
const fs   = require('fs');
const path = require('path');
const os   = require('os');

class AEBridge {
  constructor() {
    this.tmpDir      = os.tmpdir();
    this.scriptPath  = path.join(this.tmpDir, 'colorlab_run.jsx');
    this.resultPath  = path.join(this.tmpDir, 'colorlab_result.json');
    this.colorlabJsx = fs.readFileSync(
      path.join(__dirname, '..', 'jsx', 'colorlab.jsx'),
      'utf8'
    );
    this.glowJsx = fs.readFileSync(
      path.join(__dirname, '..', 'jsx', 'glow.jsx'),
      'utf8'
    );
  }

  // ── Check if AE is running via COM ─────────────────────────
  async isAERunning() {
    const ps = `
      try {
        $ae = [Runtime.InteropServices.Marshal]::GetActiveObject("AfterFX.Application")
        Write-Output "ok:$($ae.version)"
      } catch {
        Write-Output "no"
      }
    `;
    try {
      const out = execSync(
        `powershell -NoProfile -NonInteractive -Command "${ps.replace(/"/g, '\\"')}"`,
        { stdio: 'pipe', encoding: 'utf8', timeout: 6000 }
      ).trim();
      if (out.startsWith('ok:')) {
        return { running: true, version: out.slice(3) };
      }
    } catch (_) { /* fall through */ }
    return { running: false };
  }

  // ── Build the JSX that AE will execute ─────────────────────
  //   libSrc   : the tool's ExtendScript library source
  //   callExpr : the invocation, e.g. "ColorLab.apply(params)"
  _buildScript(libSrc, callExpr, params) {
    const resultFwd = this.resultPath.replace(/\\/g, '/');
    return `(function() {
  try {
    ${libSrc}
    var params = ${JSON.stringify(params)};
    var result = ${callExpr};
    var f = new File("${resultFwd}");
    f.open('w');
    f.write(JSON.stringify(result || { ok: true }));
    f.close();
  } catch(e) {
    var f = new File("${resultFwd}");
    f.open('w');
    f.write(JSON.stringify({ error: e.toString() }));
    f.close();
  }
})();
`;
  }

  // ── Public tool entry points ───────────────────────────────
  applyColorGrade(params) {
    return this._run(this._buildScript(this.colorlabJsx, 'ColorLab.apply(params)', params));
  }
  applyGlow(params) {
    return this._run(this._buildScript(this.glowJsx, 'DeepGlow.apply(params)', params));
  }

  // ── Execute a built JSX string in AE + read its result ─────
  async _run(jsx) {
    fs.writeFileSync(this.scriptPath, jsx, 'utf8');
    if (fs.existsSync(this.resultPath)) fs.unlinkSync(this.resultPath);

    const scriptEsc = this.scriptPath.replace(/\\/g, '\\\\');
    const ps = `
      try {
        $ae = [Runtime.InteropServices.Marshal]::GetActiveObject("AfterFX.Application")
        $ae.DoScript("${scriptEsc}")
        Write-Output "sent"
      } catch {
        Write-Error $_.Exception.Message
        exit 1
      }
    `;

    try {
      execSync(
        `powershell -NoProfile -NonInteractive -Command "${ps.replace(/"/g, '\\"')}"`,
        { stdio: 'pipe', timeout: 12000 }
      );
    } catch (e) {
      return { error: 'Could not reach After Effects. Make sure AE is open with a project loaded.' };
    }

    // Poll for result file (max 30 s)
    for (let i = 0; i < 300; i++) {
      await new Promise(r => setTimeout(r, 100));
      if (fs.existsSync(this.resultPath)) {
        try {
          return JSON.parse(fs.readFileSync(this.resultPath, 'utf8'));
        } catch {
          return { error: 'Unexpected response from After Effects.' };
        }
      }
    }
    return { error: 'After Effects timed out. Make sure a composition is open.' };
  }
}

module.exports = AEBridge;
