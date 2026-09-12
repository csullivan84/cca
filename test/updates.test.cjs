const { test } = require('node:test'),
  assert = require('node:assert/strict'),
  crypto = require('node:crypto')
const U = require('../src/core/updates.cjs')
const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519')
function envelope(overrides = {}) {
  const payload = JSON.stringify({
    version: '4.0.1',
    platform: 'win32',
    arch: 'x64',
    url: 'https://updates.example/cca.zip',
    sha256: 'a'.repeat(64),
    size: 100,
    expires: new Date(Date.now() + 3600000).toISOString(),
    ...overrides
  })
  return {
    payload,
    signature: crypto
      .sign(null, Buffer.from(payload), privateKey)
      .toString('base64')
  }
}
test('accepts authentic platform-specific release metadata', () =>
  assert.equal(
    U.verifyEnvelope(envelope(), publicKey, 'win32', 'x64').version,
    '4.0.1'
  ))
test('rejects tampered metadata and wrong signing keys', () => {
  const e = envelope()
  e.payload = e.payload.replace('4.0.1', '9.0.0')
  assert.throws(() => U.verifyEnvelope(e, publicKey, 'win32', 'x64'))
  assert.throws(() =>
    U.verifyEnvelope(
      envelope(),
      crypto.generateKeyPairSync('ed25519').publicKey,
      'win32',
      'x64'
    )
  )
})
test('rejects wrong architecture, expired metadata and huge downloads', () => {
  assert.throws(() => U.verifyEnvelope(envelope(), publicKey, 'win32', 'arm64'))
  assert.throws(() =>
    U.verifyEnvelope(
      envelope({ expires: '2020-01-01' }),
      publicKey,
      'win32',
      'x64'
    )
  )
  assert.throws(() =>
    U.verifyEnvelope(envelope({ size: 1e12 }), publicKey, 'win32', 'x64')
  )
})
test('semver ordering rejects downgrades', () => {
  assert.equal(U.isNewer('4.0.1', '4.0.0'), true)
  assert.equal(U.isNewer('4.0.0', '4.0.0'), false)
  assert.equal(U.isNewer('3.9.9', '4.0.0'), false)
  assert.equal(U.isNewer('4.10.0', '4.9.0'), true)
})
test('private download sends token only to configured origin and verifies streamed bytes', async () => {
  const fs = require('node:fs/promises'),
    os = require('node:os'),
    path = require('node:path')
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'cca-update-'))
  const originalFetch = global.fetch,
    old = { ...process.env }
  const content = Buffer.from('verified zip content'),
    expires = new Date(Date.now() + 3600000).toISOString()
  let calls = 0
  process.env.CCA_UPDATE_URL = 'https://private.example/manifest'
  process.env.CCA_UPDATE_PUBLIC_KEY = publicKey.export({
    type: 'spki',
    format: 'pem'
  })
  process.env.CCA_UPDATE_TOKEN = 'test-only-token'
  const data = {
    url: 'https://private.example/cca.zip',
    size: content.length,
    sha256: crypto.createHash('sha256').update(content).digest('hex'),
    expires
  }
  global.fetch = async (url, options) => {
    calls++
    assert.equal(new URL(url).origin, 'https://private.example')
    assert.equal(options.headers.Authorization, 'Bearer test-only-token')
    assert.equal(options.redirect, 'error')
    return new Response(content)
  }
  try {
    const destination = path.join(directory, 'cca.zip')
    await U.download(data, destination)
    assert.deepEqual(await fs.readFile(destination), content)
    await assert.rejects(
      U.download({ ...data, url: 'https://other.example/cca.zip' }, destination)
    )
    assert.equal(calls, 1)
    await assert.rejects(
      U.download(
        { ...data, sha256: '0'.repeat(64) },
        path.join(directory, 'bad.zip')
      )
    )
    await assert.rejects(fs.stat(path.join(directory, 'bad.zip')))
    await fs.writeFile(destination + '.partial', 'keep me')
    await assert.rejects(U.download(data, destination))
    assert.equal(await fs.readFile(destination + '.partial', 'utf8'), 'keep me')
  } finally {
    global.fetch = originalFetch
    for (const key of [
      'CCA_UPDATE_URL',
      'CCA_UPDATE_PUBLIC_KEY',
      'CCA_UPDATE_TOKEN'
    ])
      if (old[key] === undefined) delete process.env[key]
      else process.env[key] = old[key]
    await fs.rm(directory, { recursive: true, force: true })
  }
})
