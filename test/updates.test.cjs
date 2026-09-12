const {test}=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto')
const U=require('../src/core/updates.cjs')
const {privateKey,publicKey}=crypto.generateKeyPairSync('ed25519')
function envelope(overrides={}){const payload=JSON.stringify({version:'4.0.1',platform:'win32',arch:'x64',url:'https://updates.example/cca.zip',sha256:'a'.repeat(64),size:100,expires:new Date(Date.now()+3600000).toISOString(),...overrides});return{payload,signature:crypto.sign(null,Buffer.from(payload),privateKey).toString('base64')}}
test('accepts authentic platform-specific release metadata',()=>assert.equal(U.verifyEnvelope(envelope(),publicKey,'win32','x64').version,'4.0.1'))
test('rejects tampered metadata and wrong signing keys',()=>{const e=envelope();e.payload=e.payload.replace('4.0.1','9.0.0');assert.throws(()=>U.verifyEnvelope(e,publicKey,'win32','x64'));assert.throws(()=>U.verifyEnvelope(envelope(),crypto.generateKeyPairSync('ed25519').publicKey,'win32','x64'))})
test('rejects wrong architecture, expired metadata and huge downloads',()=>{assert.throws(()=>U.verifyEnvelope(envelope(),publicKey,'win32','arm64'));assert.throws(()=>U.verifyEnvelope(envelope({expires:'2020-01-01'}),publicKey,'win32','x64'));assert.throws(()=>U.verifyEnvelope(envelope({size:1e12}),publicKey,'win32','x64'))})
test('semver ordering rejects downgrades',()=>{assert.equal(U.isNewer('4.0.1','4.0.0'),true);assert.equal(U.isNewer('4.0.0','4.0.0'),false);assert.equal(U.isNewer('3.9.9','4.0.0'),false);assert.equal(U.isNewer('4.10.0','4.9.0'),true)})
