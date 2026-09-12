// Opt-in private release downloads. Never execute downloaded code or ship credentials.
const crypto=require('node:crypto')
const fs=require('node:fs/promises')
function verifyEnvelope(envelope, publicKey, platform, arch) {
  if (!envelope || typeof envelope.payload!=='string' || typeof envelope.signature!=='string' || envelope.payload.length>32000) throw new Error('Invalid update manifest')
  if (!crypto.verify(null,Buffer.from(envelope.payload),publicKey,Buffer.from(envelope.signature,'base64'))) throw new Error('Update signature is not trusted')
  const data=JSON.parse(envelope.payload)
  if (!/^\d+\.\d+\.\d+$/.test(data.version) || data.platform!==platform || data.arch!==arch || !/^[a-f0-9]{64}$/.test(data.sha256) || !Number.isInteger(data.size) || data.size<1 || data.size>600*1024*1024 || typeof data.url!=='string' || !Number.isFinite(Date.parse(data.expires)) || Date.parse(data.expires)<Date.now()) throw new Error('Invalid or expired update metadata')
  return data
}
function isNewer(a,b) {const aa=a.split('.').map(Number),bb=b.split('.').map(Number);for(let i=0;i<3;i++){if(aa[i]!==bb[i])return aa[i]>bb[i]}return false}
function config() {
  const {CCA_UPDATE_URL,CCA_UPDATE_PUBLIC_KEY,CCA_UPDATE_TOKEN}=process.env
  if (!CCA_UPDATE_URL || !CCA_UPDATE_PUBLIC_KEY || !CCA_UPDATE_TOKEN) return null
  const url=new URL(CCA_UPDATE_URL)
  if(url.protocol!=='https:' || url.username || url.password) throw new Error('Updates require an HTTPS endpoint without URL credentials')
  return {url,publicKey:CCA_UPDATE_PUBLIC_KEY.replaceAll('\\n','\n'),token:CCA_UPDATE_TOKEN}
}
async function response(url,cfg) {
  const target=new URL(url)
  if(target.origin!==cfg.url.origin || target.protocol!=='https:' || target.username || target.password) throw new Error('Update URL must stay on the configured HTTPS origin')
  const res=await fetch(target,{headers:{Authorization:`Bearer ${cfg.token}`},redirect:'error',signal:AbortSignal.timeout(120000)})
  if(!res.ok)throw new Error(`Update service returned ${res.status}`)
  return res
}
async function readLimited(res,limit) {
  const chunks=[];let size=0
  for await(const chunk of res.body){size+=chunk.length;if(size>limit){await res.body.cancel().catch(()=>{});throw new Error('Update exceeds allowed size')}chunks.push(chunk)}
  return Buffer.concat(chunks)
}
async function check(version) {
  const cfg=config();if(!cfg)return {enabled:false,message:'Private updates are disabled. This build never checks upstream. Use a trusted new CCA archive to upgrade.'}
  const res=await response(cfg.url,cfg)
  const data=verifyEnvelope(JSON.parse((await readLimited(res,48000)).toString()),cfg.publicKey,process.platform,process.arch)
  if(!isNewer(data.version,version))return {enabled:true,available:false,message:'No newer signed release.'}
  if(new URL(data.url).origin!==cfg.url.origin)throw new Error('Artifact origin is not trusted')
  return {enabled:true,available:true,data,message:`Verified release ${data.version} is available.`}
}
async function download(data,destination) {
  const cfg=config();if(!cfg)throw new Error('Updates are not configured')
  const res=await response(data.url,cfg), temporary=destination+'.partial'
  let handle,size=0;const hash=crypto.createHash('sha256')
  try{
    handle=await fs.open(temporary,'wx',0o600)
    for await(const chunk of res.body){size+=chunk.length;if(size>data.size)throw new Error('Update exceeds signed size');hash.update(chunk);await handle.write(chunk)}
    await handle.close();handle=null
    if(size!==data.size || hash.digest('hex')!==data.sha256)throw new Error('Update checksum does not match signed manifest')
    await fs.rename(temporary,destination)
  }catch(error){if(handle)await handle.close();await fs.unlink(temporary).catch(()=>{});throw error}
}
module.exports={verifyEnvelope,isNewer,check,download}
