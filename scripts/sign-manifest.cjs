// Signs metadata only. OS code signing/notarization is a separate release gate.
const fs = require('node:fs'),
  crypto = require('node:crypto'),
  path = require('node:path')
async function main() {
  const [artifact, version, platform, arch, url, output] = process.argv.slice(2)
  if (
    !artifact ||
    !/^\d+\.\d+\.\d+$/.test(version) ||
    !['win32', 'darwin', 'linux'].includes(platform) ||
    !['x64', 'arm64'].includes(arch) ||
    !output
  )
    throw new Error(
      'Usage: CCA_RELEASE_PRIVATE_KEY_FILE=/secure/key.pem node scripts/sign-manifest.cjs artifact.zip version platform arch https://origin/artifact.zip manifest.json'
    )
  const target = new URL(url)
  if (target.protocol !== 'https:' || target.username || target.password)
    throw new Error('Artifact URL must be HTTPS without embedded credentials.')
  if (!process.env.CCA_RELEASE_PRIVATE_KEY_FILE)
    throw new Error(
      'A release signing key file is required. No key is stored in this repository.'
    )
  const key = crypto.createPrivateKey(
    fs.readFileSync(process.env.CCA_RELEASE_PRIVATE_KEY_FILE)
  )
  if (key.asymmetricKeyType !== 'ed25519')
    throw new Error('Use an Ed25519 release signing key.')
  const stat = fs.statSync(artifact)
  if (!stat.isFile() || stat.size > 600 * 1024 * 1024)
    throw new Error('Artifact exceeds 600 MB limit.')
  const hash = crypto.createHash('sha256')
  for await (const chunk of fs.createReadStream(artifact)) hash.update(chunk)
  const payload = JSON.stringify({
    version,
    platform,
    arch,
    url: target.href,
    size: stat.size,
    sha256: hash.digest('hex'),
    expires: new Date(Date.now() + 30 * 86400000).toISOString()
  })
  fs.writeFileSync(
    output,
    JSON.stringify(
      {
        payload,
        signature: crypto
          .sign(null, Buffer.from(payload), key)
          .toString('base64')
      },
      null,
      2
    ) + '\n',
    { flag: 'wx' }
  )
  console.log('Signed manifest written:', path.basename(output))
}
main().catch((error) => {
  console.error(error.message)
  process.exitCode = 1
})
