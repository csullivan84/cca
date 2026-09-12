const { app, BrowserWindow, ipcMain, protocol, net, session, Menu, dialog, clipboard, shell, screen }=require('electron')
const fs=require('node:fs')
const fsp=require('node:fs/promises')
const path=require('node:path')
const {pathToFileURL}=require('node:url')
const {defaults,validate,recoverBounds}=require('./core/state.cjs')
const {report}=require('./core/analysis.cjs')
const updates=require('./core/updates.cjs')
const packageInfo=require('../package.json')
const APP_URL='cca://app/index.html'
protocol.registerSchemesAsPrivileged([{scheme:'cca',privileges:{standard:true,secure:true,supportFetchAPI:true,stream:true}}])
app.setName('CCA')
app.setAppUserModelId('com.csullivan84.cca')
let win,state,storePath,saveTimer,pendingUpdate
let dataDir=process.env.CCA_TEST_PROFILE
if(!dataDir && process.platform==='win32') {
  const root=path.dirname(app.getPath('exe'))
  if(fs.existsSync(path.join(root,'portable.txt'))) dataDir=path.join(root,'data')
}
dataDir=dataDir || path.join(app.getPath('appData'),'cca-independent')
try{fs.mkdirSync(dataDir,{recursive:true});fs.accessSync(dataDir,fs.constants.W_OK)}catch{dataDir=path.join(app.getPath('appData'),'cca-independent');fs.mkdirSync(dataDir,{recursive:true})}
app.setPath('userData',dataDir)
storePath=path.join(dataDir,'workspace.json')
let startupWarning=''
function readState(){try{if(fs.statSync(storePath).size>1024*1024)throw new Error('Settings file too large');return validate(JSON.parse(fs.readFileSync(storePath,'utf8')))}catch(error){if(error.code!=='ENOENT'){startupWarning='Saved settings could not be read. A backup was kept; defaults are active.';try{fs.renameSync(storePath,storePath+'.corrupt-'+Date.now())}catch{}}return defaults()}}
function save(){clearTimeout(saveTimer);try{const temp=storePath+'.tmp';fs.writeFileSync(temp,JSON.stringify(state),{mode:0o600});fs.renameSync(temp,storePath)}catch{if(win&&!win.isDestroyed())win.webContents.send('cca:notice','Could not save settings. Check free space and folder permissions.')}}
function scheduleSave(){clearTimeout(saveTimer);saveTimer=setTimeout(save,200)}
function trusted(event){return win && !win.isDestroyed() && event.sender===win.webContents && event.senderFrame===win.webContents.mainFrame && event.senderFrame.url===APP_URL}
function handle(name,fn){ipcMain.handle('cca:'+name,async(event,...args)=>{if(!trusted(event))throw new Error('Untrusted IPC sender');return fn(...args)})}
function text(value,max){if(typeof value!=='string'||value.length>max)throw new Error('Invalid text payload');return value}
const languages=Object.fromEntries(fs.readdirSync(path.join(__dirname,'views/translations')).filter(f=>/^[a-z]{2}(?:-[A-Za-z]{2,4})?\.json$/.test(f)).map(f=>[f.slice(0,-5),JSON.parse(fs.readFileSync(path.join(__dirname,'views/translations',f),'utf8'))]))
handle('load',()=>({state,version:packageInfo.version,platform:process.platform,portable:process.platform==='win32'&&dataDir===path.join(path.dirname(app.getPath('exe')),'data'),languages,startupWarning}))
handle('save',input=>{const next=validate(input);next.bounds=state.bounds;state=next;win.setAlwaysOnTop(state.settings.alwaysOnTop);scheduleSave();return true})
handle('copy',async value=>{await clipboard.writeText(text(value,200000));return true})
handle('export',async(rows,type)=>{
  if(!['html','txt','json','csv'].includes(type))throw new Error('Invalid export type')
  const content=report(rows,type)
  const result=await dialog.showSaveDialog(win,{title:'Export contrast report',defaultPath:`cca-report.${type}`,filters:[{name:type.toUpperCase(),extensions:[type]}]})
  if(result.canceled)return false
  await fsp.writeFile(result.filePath,content,'utf8');return true
})
handle('openHelp',async key=>{
  const urls={minimum:'https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html',enhanced:'https://www.w3.org/WAI/WCAG22/Understanding/contrast-enhanced.html',nonText:'https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html',upstream:'https://github.com/ThePacielloGroup/CCAe'}
  if(!Object.hasOwn(urls,key))throw new Error('Unknown help link')
  await shell.openExternal(urls[key])
})
handle('updates',async()=>{const result=await updates.check(packageInfo.version);pendingUpdate=result.available?result.data:null;return {enabled:result.enabled,available:!!result.available,message:result.message}})
handle('downloadUpdate',async()=>{
  if(!pendingUpdate)throw new Error('Check for a signed update first')
  const info=pendingUpdate
  const result=await dialog.showSaveDialog(win,{title:'Save verified CCA update',defaultPath:`cca-${info.version}-${process.platform}-${process.arch}.zip`,filters:[{name:'ZIP archive',extensions:['zip']}]})
  if(result.canceled)return false
  await updates.download(info,result.filePath);return true
})
function createWindow(){
  const bounds=recoverBounds(state.bounds,screen.getAllDisplays())
  win=new BrowserWindow({...bounds,minWidth:360,minHeight:400,title:'CCA — Colour Contrast Analyser',show:false,alwaysOnTop:state.settings.alwaysOnTop,backgroundColor:'#f5f7fa',webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true,webSecurity:true,spellcheck:false}})
  win.webContents.setWindowOpenHandler(()=>({action:'deny'}))
  win.webContents.on('will-navigate',(event,url)=>{if(url!==APP_URL)event.preventDefault()})
  win.webContents.on('will-redirect',event=>event.preventDefault())
  win.webContents.on('will-attach-webview',event=>event.preventDefault())
  win.webContents.on('context-menu',(_,params)=>{
    if(params.isEditable || params.selectionText)Menu.buildFromTemplate([{role:'cut'},{role:'copy'},{role:'paste'},{role:'selectAll'}]).popup({window:win})
  })
  win.on('resize',()=>{if(!win.isMaximized()&&!win.isMinimized()){state.bounds=win.getBounds();scheduleSave()}})
  win.on('move',()=>{if(!win.isMaximized()&&!win.isMinimized()){state.bounds=win.getBounds();scheduleSave()}})
  win.once('ready-to-show',()=>win.show())
  win.on('close',save)
  win.on('closed',()=>{win=null})
  win.loadURL(APP_URL)
}
if(!app.requestSingleInstanceLock()){app.quit()}else{
  app.on('second-instance',()=>{if(win){if(win.isMinimized())win.restore();win.show();win.focus()}})
  app.whenReady().then(()=>{
    state=readState()
    protocol.handle('cca',request=>{
      const url=new URL(request.url)
      const allowed={'/index.html':'index.html','/app.bundle.js':'app.bundle.js','/style.css':'style.css'}
      if(url.hostname!=='app'||!Object.hasOwn(allowed,url.pathname))return new Response('Not found',{status:404})
      return net.fetch(pathToFileURL(path.join(__dirname,'ui',allowed[url.pathname])).href)
    })
    session.defaultSession.setPermissionRequestHandler((contents,permission,callback)=>callback(false))
    session.defaultSession.setPermissionCheckHandler(()=>false)
    const action=name=>()=>win?.webContents.send('cca:action',name)
    Menu.setApplicationMenu(Menu.buildFromTemplate([
      {label:'CCA',submenu:[{label:'About CCA',accelerator:'F1',click:action('about')},{label:'Preferences',accelerator:'CmdOrCtrl+,',click:action('settings')},{type:'separator'},{role:'quit'}]},
      {label:'Edit',submenu:[{role:'undo'},{role:'redo'},{type:'separator'},{role:'cut'},{role:'copy'},{role:'paste'},{role:'selectAll'},{type:'separator'},{label:'Read contrast result',click:action('read')},{label:'Copy contrast report',click:action('copy')},{label:'Undo colour change',click:action('undo')},{label:'Redo colour change',click:action('redo')}]},
      {label:'View',submenu:[{role:'resetZoom'},{role:'zoomIn'},{role:'zoomOut'},{role:'togglefullscreen'},{label:'Centre window on primary display',click:()=>{if(win)win.setBounds(recoverBounds(null,screen.getAllDisplays()))}},{label:'Keyboard shortcuts',click:action('settings')}]}
    ]))
    createWindow()
    const recover=()=>{if(win&&!win.isDestroyed())win.setBounds(recoverBounds(win.getBounds(),screen.getAllDisplays()))}
    screen.on('display-removed',recover);screen.on('display-metrics-changed',recover)
    app.on('activate',()=>{if(!win)createWindow();else win.show()})
  }).catch(error=>{console.error(error);app.exit(1)})
  app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit()})
  app.on('before-quit',()=>{if(state)save()})
}
