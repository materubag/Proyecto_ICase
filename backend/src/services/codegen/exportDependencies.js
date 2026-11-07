const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

async function prepareExportDependencies(directory, options = {}) {
  const root = path.resolve(directory);
  const locks = [];
  const npm = [process.env.npm_execpath, path.join(path.dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js'), path.resolve(path.dirname(process.execPath), '../lib/node_modules/npm/bin/npm-cli.js'), '/usr/share/nodejs/npm/bin/npm-cli.js'].find(file => file && fs.existsSync(file));
  for (const part of ['backend', 'frontend']) {
    const cwd = path.join(root, part);
    const marker = path.join(cwd, 'node_modules', part === 'backend' ? 'sequelize/package.json' : 'vite/package.json');
    if (!fs.existsSync(marker)) {
      if (!npm) throw Object.assign(new Error('NPM_INSTALLER_UNAVAILABLE'), { code: 'MISSING_EXPORTED_DEPENDENCIES' });
      options.onProgress?.({ check: 'Instalando dependencias aisladas de ' + part });
      await new Promise((resolve, reject) => {
        const child = spawn(process.execPath, [npm, 'install', '--ignore-scripts', '--no-audit', '--no-fund'], { cwd, windowsHide: true, stdio: 'ignore' });
        const timeout = setTimeout(() => { child.kill(); reject(Object.assign(new Error('DEPENDENCY_INSTALL_TIMEOUT'), { code: 'MISSING_EXPORTED_DEPENDENCIES' })); }, options.timeoutMs || 180000);
        child.on('error', error => { clearTimeout(timeout); reject(error); });
        child.on('exit', code => { clearTimeout(timeout); code === 0 ? resolve() : reject(Object.assign(new Error('EXPORTED_DEPENDENCY_INSTALL_FAILED'), { code: 'MISSING_EXPORTED_DEPENDENCIES' })); });
      });
    }
    if (fs.existsSync(path.join(cwd, 'package-lock.json'))) locks.push(part + '/package-lock.json');
  }
  return locks;
}
module.exports = { prepareExportDependencies };
