const { test } = require('node:test'),
  assert = require('node:assert/strict'),
  fs = require('node:fs/promises'),
  path = require('node:path'),
  os = require('node:os')
const afterPack = require('../scripts/after-pack.cjs')
for (const [platform, targets, portable] of [
  ['win32', ['zip'], true],
  ['win32', ['dir'], true],
  ['win32', ['nsis'], false],
  ['darwin', ['zip'], false]
])
  test(`portable build marker ${platform} ${targets}`, async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'cca-pack-'))
    try {
      await afterPack({
        electronPlatformName: platform,
        targets: targets.map((name) => ({ name })),
        appOutDir: directory
      })
      const files = await fs.readdir(directory)
      assert.equal(files.includes('portable.txt'), portable)
      if (portable) {
        assert.match(
          await fs.readFile(path.join(directory, 'Start CCA.cmd'), 'utf8'),
          /%~dp0CCA.exe/
        )
        assert.match(
          await fs.readFile(path.join(directory, 'README-WINDOWS.txt'), 'utf8'),
          /unsigned/
        )
      }
    } finally {
      await fs.rm(directory, { recursive: true, force: true })
    }
  })
