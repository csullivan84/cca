const fs = require('node:fs/promises')
const path = require('node:path')
module.exports = async (context) => {
  if (context.electronPlatformName !== 'win32') return
  const portable = context.targets.every((target) =>
    ['zip', 'dir'].includes(target.name)
  )
  if (!portable) return
  await fs.writeFile(
    path.join(context.appOutDir, 'portable.txt'),
    'CCA portable mode. Remove this marker to use per-user application data.\r\n'
  )
  await fs.writeFile(
    path.join(context.appOutDir, 'Start CCA.cmd'),
    '@echo off\r\ncd /d "%~dp0"\r\nstart "" "%~dp0CCA.exe"\r\n'
  )
  await fs.writeFile(
    path.join(context.appOutDir, 'README-WINDOWS.txt'),
    'CCA 4.0.0 - Windows x64\r\n\r\nExtract the entire archive before running CCA.exe or Start CCA.cmd.\r\nNo Node.js, Git, GitHub login or administrator install is required.\r\nKeep all DLLs and resources beside the EXE.\r\nPortable preferences are stored in the adjacent data folder.\r\nThis build is unsigned. Do not disable system security protections.\r\nSource and GPL license: https://github.com/csullivan84/cca (private repository).\r\nThe complete cca.zip delivery also includes source.\r\n'
  )
}
