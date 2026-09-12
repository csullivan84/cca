const esbuild = require('esbuild')
esbuild.buildSync({
  entryPoints: ['src/ui/app.js'],
  bundle: true,
  platform: 'browser',
  target: 'chrome152',
  outfile: 'src/ui/app.bundle.js',
  legalComments: 'eof'
})
