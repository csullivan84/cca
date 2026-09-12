const { analyze } = require('./analysis.cjs')
const ACTIONS = ['read','foreground','background','swap','undo','redo','copy']
const shortcuts = {read:'Alt+R',foreground:'F11',background:'F12',swap:'Alt+S',undo:'Alt+Z',redo:'Alt+Y',copy:'Alt+C'}
const defaults=()=>({pair:{foreground:'#000000',background:'#ffffff'},history:[],favorites:[],settings:{theme:'system',lang:'en',rounding:2,alwaysOnTop:false,shortcuts:{...shortcuts},regularTemplate:'Foreground: %f%\nBackground: %b%\nContrast: %ratio%:1\nAA: %aa%\nAAA: %aaa%',shortTemplate:'%f% on %b%: %ratio%:1'},bounds:null})
const object=v=>v && typeof v==='object' && !Array.isArray(v)
function pair(v) {
  if (!object(v)) throw new Error('Invalid colour pair')
  analyze(v.foreground,v.background)
  return {foreground:v.foreground,background:v.background}
}
function validateShortcuts(v) {
  if (!object(v) || Object.keys(v).some(k=>!ACTIONS.includes(k))) throw new Error('Unknown shortcut action')
  const result={}
  for (const action of ACTIONS) {
    const key=v[action]
    if (typeof key!=='string' || !/^(?:(?:Alt|Control|Meta|Shift)\+)*(?:[A-Z0-9]|F(?:[1-9]|1[0-2]))$/.test(key)) throw new Error('Use keys like Alt+R or F11.')
    const parts=key.split('+'), base=parts.pop(), mods=parts.sort()
    if (new Set(mods).size!==mods.length || (!mods.length && !/^F\d+$/.test(base))) throw new Error('Letter shortcuts need a modifier.')
    if (!mods.includes('Alt') && !/^F\d+$/.test(base)) throw new Error('Use Alt for letter shortcuts to avoid editing and screen-reader commands.')
    if (['F1','F5','F10'].includes(base) || (mods.includes('Alt') && base==='F4')) throw new Error('That key is reserved by the application or operating system.')
    result[action]=[...mods,base].join('+')
  }
  if (new Set(Object.values(result)).size!==ACTIONS.length) throw new Error('Two actions cannot use the same shortcut.')
  return result
}
function settings(v) {
  if (!object(v)) throw new Error('Invalid settings')
  if (!['system','light','dark'].includes(v.theme) || typeof v.lang!=='string' || !/^[a-z]{2}(?:-[A-Za-z]{2,4})?$/.test(v.lang)) throw new Error('Invalid theme/language')
  if (!Number.isInteger(v.rounding) || v.rounding<0 || v.rounding>6 || typeof v.alwaysOnTop!=='boolean') throw new Error('Invalid preferences')
  for (const key of ['regularTemplate','shortTemplate']) if (typeof v[key]!=='string' || v[key].length>4000) throw new Error('Copy templates must be at most 4,000 characters.')
  return {theme:v.theme,lang:v.lang,rounding:v.rounding,alwaysOnTop:v.alwaysOnTop,shortcuts:validateShortcuts(v.shortcuts),regularTemplate:v.regularTemplate,shortTemplate:v.shortTemplate}
}
function validate(v) {
  if (!object(v)) throw new Error('Invalid state')
  if (!Array.isArray(v.history) || v.history.length>100 || !Array.isArray(v.favorites) || v.favorites.length>200) throw new Error('Library limit exceeded')
  const out={pair:pair(v.pair),history:v.history.map(pair),favorites:v.favorites.map(f=>{
    if (!object(f) || typeof f.name!=='string' || f.name.length<1 || f.name.length>100 || typeof f.collection!=='string' || f.collection.length>100) throw new Error('Invalid favourite')
    return {...pair(f),name:f.name,collection:f.collection}
  }),settings:settings(v.settings),bounds:null}
  if (v.bounds && ['x','y','width','height'].every(k=>Number.isFinite(v.bounds[k]))) out.bounds=Object.fromEntries(['x','y','width','height'].map(k=>[k,Math.round(v.bounds[k])]))
  return out
}
function recoverBounds(bounds,displays) {
  const area=displays[0].workArea
  const candidate=bounds || {x:area.x+40,y:area.y+40,width:920,height:780}
  const display=displays.find(d=>candidate.x+candidate.width>d.workArea.x && candidate.x<d.workArea.x+d.workArea.width && candidate.y+candidate.height>d.workArea.y && candidate.y<d.workArea.y+d.workArea.height) || displays[0]
  const w=display.workArea
  const width=Math.min(w.width,Math.max(360,candidate.width)),height=Math.min(w.height,Math.max(400,candidate.height))
  return {width,height,x:Math.max(w.x,Math.min(candidate.x,w.x+w.width-width)),y:Math.max(w.y,Math.min(candidate.y,w.y+w.height-height))}
}
class Timeline {
  constructor(initial) {this.current=pair(initial);this.past=[];this.future=[]}
  set(next) {next=pair(next); if (JSON.stringify(next)===JSON.stringify(this.current)) return false;this.past.push(this.current);if(this.past.length>100)this.past.shift();this.current=next;this.future=[];return true}
  undo() {if(this.past.length){this.future.push(this.current);this.current=this.past.pop()}return this.current}
  redo() {if(this.future.length){this.past.push(this.current);this.current=this.future.pop()}return this.current}
}
module.exports={defaults,pair,settings,validate,validateShortcuts,recoverBounds,Timeline,ACTIONS}
