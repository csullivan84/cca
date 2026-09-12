const A=require('../core/analysis.cjs')
const S=require('../core/state.cjs')
const {converter}=require('culori')
const blind=require('color-blind')
const $=id=>document.getElementById(id)
let state,timeline,loaded,announceTimer,inputTimer,suggestion,batchRows=[],imageData=null,pixel={x:0,y:0},pickerAbort=null
const previousFocus=new Map()
const sections=['foreground','background']
const shortcutLabels={read:'Read full result',foreground:'Pick foreground',background:'Pick background',swap:'Swap colours',undo:'Undo colour change',redo:'Redo colour change',copy:'Copy report'}
function notice(message){$('notice').textContent=message}
function safe(fn){return(...args)=>Promise.resolve().then(()=>fn(...args)).catch(error=>notice(error.message || String(error)))}
function persist(){window.cca.save(state).catch(error=>notice('Could not save: '+error.message))}
function resultSentence(){const r=A.analyze(state.pair.foreground,state.pair.background);return `Foreground ${r.foreground}. Background ${r.background}. Contrast ${r.raw.toFixed(4)} to 1. AA regular ${r.aa?'pass':'fail'}, AA large ${r.aaLarge?'pass':'fail'}, AAA regular ${r.aaa?'pass':'fail'}, AAA large ${r.aaaLarge?'pass':'fail'}, non-text ${r.nonText?'pass':'fail'}.`}
function announce(immediate=false){clearTimeout(announceTimer);if(immediate)$('live-result').textContent='';announceTimer=setTimeout(()=>$('live-result').textContent=resultSentence(),immediate?40:650)}
function renderPair(force=false){
  const r=A.analyze(state.pair.foreground,state.pair.background)
  for(const section of sections){
    const c=A.color(state.pair[section]);$(''+section+'-swatch').style.background=A.format(state.pair[section],'rgb')
    if(force || document.activeElement!==$(section))$(section).value=state.pair[section]
    if(force){$(section).removeAttribute('aria-invalid');$(section+'-error').textContent=''}
    updateSliders(section,c)
  }
  const rawText=r.raw.toFixed(state.settings.rounding)
  const threshold=[3,4.5,7].find(t=>r.raw<t && Number(rawText)>=t)
  $('ratio').textContent=`${rawText}:1`
  $('precision').textContent=threshold?`Just below ${threshold}:1. Unrounded ratio: ${r.raw}.`:`Pass/fail uses the unrounded ratio (${r.raw}).`
  const criteria=[['AA regular text',r.aa,'4.5:1'],['AA large text',r.aaLarge,'3:1'],['AAA regular text',r.aaa,'7:1'],['AAA large text',r.aaaLarge,'4.5:1'],['Non-text visuals',r.nonText,'3:1']]
  $('criteria').replaceChildren(...criteria.map(([label,pass,threshold])=>{const li=document.createElement('li'),name=document.createElement('span'),status=document.createElement('strong');name.textContent=label+' · '+threshold;status.textContent=pass?'Pass':'Fail';status.className=pass?'pass':'fail';li.append(name,status);return li}))
  $('compositing').textContent=`Effective foreground ${r.effectiveForeground} on ${r.effectiveBackground}. Foreground opacity ${(r.alpha*100).toFixed(1)}%; background ${(r.backgroundAlpha*100).toFixed(1)}%. Transparent backgrounds are composited on white.`
  $('gamut-warning').hidden=!r.clipped;$('gamut-warning').textContent='Out-of-sRGB-gamut input: channels were clipped to sRGB before contrast analysis and display. Results describe that clipped colour, not the original wide-gamut colour.'
  $('sample').style.color=r.effectiveForeground;$('sample').style.backgroundColor=r.effectiveBackground
  $('undo').disabled=!timeline.past.length;$('redo').disabled=!timeline.future.length
  suggestion=null;$('apply-suggestion').disabled=true
  renderPreview();renderSimulations(r);announce()
}
function addHistory(){const p={...state.pair};state.history=[p,...state.history.filter(r=>r.foreground!==p.foreground || r.background!==p.background)].slice(0,100)}
function commit(next,force=false){if(timeline.set(next)){state.pair={...timeline.current};addHistory();persist();renderLibrary()}else state.pair={...next};renderPair(force)}
function validateInput(section){try{A.color($(section).value);$(section).removeAttribute('aria-invalid');$(section+'-error').textContent='';return true}catch(error){$(section).setAttribute('aria-invalid','true');$(section+'-error').textContent=error.message;return false}}
function editInput(section){if(validateInput(section))commit({...state.pair,[section]:$(section).value})}
function channelSpecs(mode){return mode==='rgb'?[['r','Red',0,255,1],['g','Green',0,255,1],['b','Blue',0,255,1],['alpha','Opacity',0,1,.01]]:mode==='hsl'?[['h','Hue',0,360,1],['s','Saturation',0,100,1],['l','Lightness',0,100,1],['alpha','Opacity',0,1,.01]]:[['h','Hue',0,360,1],['s','Saturation',0,100,1],['v','Value',0,100,1],['alpha','Opacity',0,1,.01]]}
function sliderMode(section){const m=$(section+'-format').value;return ['hsl','hsv'].includes(m)?m:'rgb'}
function buildSliders(section){
  const mode=sliderMode(section),host=$(section+'-channels');host.replaceChildren()
  const sync=document.createElement('label');sync.className='check';const checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.id=section+'-sync';sync.append(checkbox,document.createTextNode('Synchronize RGB channels'));sync.hidden=mode!=='rgb';host.append(sync)
  for(const [key,label,min,max,step]of channelSpecs(mode)){
    const row=document.createElement('div');row.className='channel';const name=document.createElement('label');name.htmlFor=`${section}-${key}-range`;name.textContent=label;row.append(name)
    for(const type of ['range','number']){const input=document.createElement('input');Object.assign(input,{type,min,max,step,id:`${section}-${key}-${type}`});input.setAttribute('aria-label',`${section} ${label} ${type==='number'?'value':'slider'}`);input.addEventListener('input',()=>{
      const n=Number(input.value);if(input.value===''||!Number.isFinite(n)||n<min||n>max){input.setAttribute('aria-invalid','true');return}input.removeAttribute('aria-invalid')
      const c=A.color(state.pair[section]),v=converter(mode)(c);v.alpha=c.alpha
      const value=key==='alpha'?n:mode==='rgb'?n/255:key==='h'?n:n/100
      if(mode==='rgb' && key!=='alpha' && $(section+'-sync').checked){const delta=value-v[key];const shift=Math.max(-Math.min(v.r,v.g,v.b),Math.min(delta,1-Math.max(v.r,v.g,v.b)));for(const k of ['r','g','b'])v[k]+=shift}else v[key]=value
      const rgb=converter('rgb')(v);const css=`rgb(${[rgb.r,rgb.g,rgb.b].map(x=>x*255).join(' ')} / ${rgb.alpha??1})`
      state.pair={...state.pair,[section]:A.format(css,$(section+'-format').value)};renderPair(true)
    });input.addEventListener('change',()=>commit({...state.pair},true));input.addEventListener('blur',()=>{if(timeline.current[section]!==state.pair[section])commit({...state.pair},true)});row.append(input)}host.append(row)
  }
}
function updateSliders(section,c){const mode=sliderMode(section),v=converter(mode)(c);for(const [key]of channelSpecs(mode)){const n=key==='alpha'?c.alpha:mode==='rgb'?v[key]*255:key==='h'?(v.h||0):v[key]*100;for(const type of ['range','number']){const el=$(`${section}-${key}-${type}`);if(el&&document.activeElement!==el)el.value=+n.toFixed(2)}}}
function renderPreview(){const size=Math.max(8,Math.min(96,Number($('font-size').value)||18)),weight=+$('font-weight').value;const large=size>=24||(weight>=700&&size>=14*96/72);$('sample').style.fontSize=size+'px';$('sample').style.fontWeight=weight;$('large-text').textContent=`${size}px at weight ${weight}: ${large?'qualifies as large text':'regular-text threshold applies'}. This preview does not measure fonts on an external page.`}
function renderSimulations(r){$('simulations').replaceChildren(...[['protanopia','Protanopia'],['deuteranopia','Deuteranopia'],['tritanopia','Tritanopia'],['protanomaly','Protanomaly'],['deuteranomaly','Deuteranomaly'],['tritanomaly','Tritanomaly'],['achromatopsia','Achromatopsia'],['achromatomaly','Achromatomaly']].map(([key,label])=>{const section=document.createElement('section'),h=document.createElement('h3'),p=document.createElement('p');h.textContent=label;p.textContent='Example text — simulation';p.style.color=blind[key](r.effectiveForeground);p.style.backgroundColor=blind[key](r.effectiveBackground);section.append(h,p);return section}))}
function renderLibrary(){
  const term=$('history-search').value.toLowerCase(),match=r=>`${r.name||''} ${r.collection||''} ${r.foreground} ${r.background}`.toLowerCase().includes(term)
  const item=(r,i,favorite)=>{const li=document.createElement('li'),button=document.createElement('button');button.textContent=`${favorite?r.collection+' / '+r.name+': ':''}${r.foreground} on ${r.background}`;button.addEventListener('click',()=>{commit({foreground:r.foreground,background:r.background},true);notice('Loaded colour pair.')});li.append(button);if(favorite){const del=document.createElement('button');del.textContent='Delete';del.setAttribute('aria-label','Delete favourite '+r.name);del.addEventListener('click',()=>{state.favorites.splice(i,1);persist();renderLibrary();$('favorite-name').focus();notice('Favourite deleted.')});li.append(del)}return li}
  const empty=message=>{const li=document.createElement('li');li.textContent=message;return li}
  const recent=state.history.map((r,i)=>({r,i})).filter(({r})=>match(r)),favorites=state.favorites.map((r,i)=>({r,i})).filter(({r})=>match(r))
  $('history-list').replaceChildren(...(recent.length?recent.map(({r,i})=>item(r,i,false)):[empty('No recent matching pairs.')]))
  $('favorite-list').replaceChildren(...(favorites.length?favorites.map(({r,i})=>item(r,i,true)):[empty('No matching favourites.')]))
}
function openDialog(id){previousFocus.set(id,document.activeElement);$(id).showModal()}
function closeDialog(id){$(id).close()}
function translate(){
  const lang=state.settings.lang,dict=loaded.languages[lang]||loaded.languages[lang.split('-')[0]]||loaded.languages.en
  const t=(key)=>dict.Main?.[key]||loaded.languages.en.Main?.[key]||key
  document.documentElement.lang=lang
  for(const [id,key]of [['foreground-title','Foreground colour'],['background-title','Background colour'],['swap','Switch Colours'],['preview-title','Sample preview']])$(id).textContent=t(key)
  for(const section of sections)$(section).setAttribute('aria-label',t(section==='foreground'?'Foreground colour value':'Background colour value'))
}
function applySettings(){document.documentElement.dataset.theme=state.settings.theme;translate();for(const [action,key]of Object.entries(state.settings.shortcuts)){const id={read:'read-result',foreground:'foreground-pick',background:'background-pick',swap:'swap',undo:'undo',redo:'redo',copy:'copy'}[action];$(id).title=shortcutLabels[action]+` (${key})`;$(id).setAttribute('aria-keyshortcuts',key)}renderPair()}
function showSettings(){const s=state.settings;$('theme').value=s.theme;$('language').value=s.lang;$('rounding').value=s.rounding;$('always-on-top').checked=s.alwaysOnTop;$('regular-template').value=s.regularTemplate;$('short-template').value=s.shortTemplate;for(const key of S.ACTIONS)$('shortcut-'+key).value=s.shortcuts[key];$('settings-error').textContent='';openDialog('settings-dialog')}
async function copy(short=false){const r=A.analyze(state.pair.foreground,state.pair.background);let template=state.settings[short?'shortTemplate':'regularTemplate'];for(const [token,value]of Object.entries({f:r.foreground,b:r.background,ratio:r.raw,aa:r.aa?'Pass':'Fail',aaa:r.aaa?'Pass':'Fail'}))template=template.replaceAll('%'+token+'%',String(value));await window.cca.copy(template);notice('Contrast report copied.')}
function pick(section){
  if(!window.EyeDropper){$('screenshot').open=true;$('pixel-section').value=section;$('screenshot-file').focus();notice('Screen picking is unavailable here. Import a screenshot and use arrow keys to sample pixels.');return}
  if(pickerAbort)pickerAbort.abort()
  const trigger=document.activeElement,controller=new AbortController();pickerAbort=controller
  notice('Screen picker active. Move to a colour and click. Press Escape to cancel. For keyboard pixel navigation, use Screenshot pixel sampler.')
  const picker=new EyeDropper()
  picker.open({signal:controller.signal}).then(result=>{commit({...state.pair,[section]:result.sRGBHex},true);notice('Picked '+result.sRGBHex)}).catch(error=>notice(error.name==='AbortError'?'Colour picking cancelled.':'Screen picker unavailable or permission denied. Use Screenshot pixel sampler.')).finally(()=>{if(pickerAbort===controller)pickerAbort=null;trigger?.focus()})
}
function action(name){if(!state)return;if(name==='settings')return showSettings();if(name==='about')return openDialog('about-dialog');if(document.querySelector('dialog[open]'))return;switch(name){case'read':announce(true);notice('Reading current contrast result.');break;case'copy':return copy();case'foreground':case'background':return pick(name);case'swap':commit({foreground:state.pair.background,background:state.pair.foreground},true);break;case'undo':case'redo':state.pair={...timeline[name]()};persist();renderPair(true);notice(name==='undo'?'Colour change undone.':'Colour change redone.');break}}
function keyString(e){const mods=[];if(e.altKey)mods.push('Alt');if(e.ctrlKey)mods.push('Control');if(e.metaKey)mods.push('Meta');if(e.shiftKey)mods.push('Shift');return [...mods.sort(),e.key.length===1?e.key.toUpperCase():e.key].join('+')}
function samplePixel(){if(!imageData)return;pixel.x=Math.max(0,Math.min(imageData.width-1,Math.round(Number($('pixel-x').value)||0)));pixel.y=Math.max(0,Math.min(imageData.height-1,Math.round(Number($('pixel-y').value)||0)));$('pixel-x').value=pixel.x;$('pixel-y').value=pixel.y;const i=(pixel.y*imageData.width+pixel.x)*4,bytes=imageData.data,a=bytes[i+3]/255;const rgb=[0,1,2].map(k=>Math.round(bytes[i+k]*a+255*(1-a)));pixel.color=A.format(`rgb(${rgb.join(' ')})`,'hex');$('pixel-result').textContent=`X ${pixel.x}, Y ${pixel.y}: ${pixel.color}. ${imageData.width} by ${imageData.height} pixels.`;$('pixel-canvas').setAttribute('aria-label','Screenshot sampler. '+$('pixel-result').textContent);notice($('pixel-result').textContent);const ctx=$('pixel-canvas').getContext('2d');ctx.putImageData(imageData,0,0);ctx.strokeStyle='#ffffff';ctx.lineWidth=1;ctx.strokeRect(pixel.x-3.5,pixel.y-3.5,7,7);ctx.strokeStyle='#000000';ctx.strokeRect(pixel.x-4.5,pixel.y-4.5,9,9)}
function imageDimensions(bytes){const dv=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);if(bytes.length>=24&&dv.getUint32(0)===0x89504e47&&dv.getUint32(4)===0x0d0a1a0a)return {width:dv.getUint32(16),height:dv.getUint32(20)};if(bytes[0]===255&&bytes[1]===216){let i=2;while(i+8<bytes.length){if(bytes[i++]!==255)continue;const marker=bytes[i++];if(marker===0xda||marker===0xd9)break;if(marker===0x01||(marker>=0xd0&&marker<=0xd7))continue;const length=dv.getUint16(i);if(length<2||i+length>bytes.length)break;if([0xc0,0xc1,0xc2].includes(marker))return {width:dv.getUint16(i+5),height:dv.getUint16(i+3)};i+=length}}throw new Error('Use a valid PNG or baseline/progressive JPEG image.')}
async function loadScreenshot(file){if(!file)return;if(file.size>32*1024*1024)throw new Error('Screenshot must be under 32 MB.');const bytes=new Uint8Array(await file.arrayBuffer()),size=imageDimensions(bytes);if(!size.width||!size.height||size.width*size.height>16000000)throw new Error('Screenshot must contain at most 16 million pixels.');const bitmap=await createImageBitmap(file);if(bitmap.width*bitmap.height>16000000){bitmap.close();throw new Error('Decoded screenshot exceeds the pixel limit.')};const canvas=$('pixel-canvas');canvas.width=bitmap.width;canvas.height=bitmap.height;const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(bitmap,0,0);bitmap.close();imageData=ctx.getImageData(0,0,canvas.width,canvas.height);canvas.hidden=false;for(const axis of ['x','y']){$('pixel-'+axis).disabled=false;$('pixel-'+axis).value=0;$('pixel-'+axis).max=(axis==='x'?canvas.width:canvas.height)-1}$('apply-pixel').disabled=false;samplePixel();canvas.focus()}
async function init(){
  loaded=await window.cca.load();state=S.validate(loaded.state);timeline=new S.Timeline(state.pair)
  for(const section of sections){buildSliders(section);$(section).addEventListener('input',()=>{clearTimeout(inputTimer);validateInput(section);inputTimer=setTimeout(()=>editInput(section),450)});$(section).addEventListener('change',()=>{clearTimeout(inputTimer);editInput(section)});$(section).addEventListener('keydown',e=>{if(e.key==='Enter'){clearTimeout(inputTimer);editInput(section)}});$(section+'-format').addEventListener('change',()=>{buildSliders(section);commit({...state.pair,[section]:A.format(state.pair[section],$(section+'-format').value)},true)});$(section+'-pick').addEventListener('click',()=>pick(section))}
  for(const [id,name]of [['read-result','read'],['swap','swap'],['undo','undo'],['redo','redo'],['copy','copy'],['settings-open','settings'],['about-open','about']])$(id).addEventListener('click',safe(()=>action(name)))
  $('copy-short').addEventListener('click',safe(()=>copy(true)))
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){if(pickerAbort)pickerAbort.abort();const details=document.activeElement?.closest('details[open]');if(details&&!document.querySelector('dialog[open]')){details.open=false;details.querySelector('summary').focus();e.preventDefault()}return}if(document.querySelector('dialog[open]'))return;const name=Object.keys(state.settings.shortcuts).find(key=>state.settings.shortcuts[key]===keyString(e));if(name){e.preventDefault();safe(action)(name)}})
  for(const dialog of document.querySelectorAll('dialog'))dialog.addEventListener('close',()=>previousFocus.get(dialog.id)?.focus())
  document.querySelectorAll('[data-close]').forEach(button=>button.addEventListener('click',()=>closeDialog(button.dataset.close)))
  document.querySelectorAll('[data-help]').forEach(button=>button.addEventListener('click',safe(()=>window.cca.openHelp(button.dataset.help))))
  for(const id of ['font-size','font-weight'])$(id).addEventListener('input',renderPreview)
  $('suggest').addEventListener('click',safe(async()=>{notice('Searching passing colours…');$('suggest').disabled=true;try{await new Promise(resolve=>setTimeout(resolve,25));suggestion=A.suggest(state.pair.foreground,state.pair.background,$('locked').value,+$('target').value);$('suggestion-result').textContent=suggestion?`Suggested ${suggestion.color}. ${suggestion.raw?.toFixed(4)||A.analyze(state.pair.foreground,state.pair.background).raw.toFixed(4)}:1. Closest sampled black/white blend; keeps ${$('locked').value} unchanged.`:'No passing colour found while preserving opacity. Increase opacity or choose a different locked colour.';$('apply-suggestion').disabled=!suggestion;notice($('suggestion-result').textContent)}finally{$('suggest').disabled=false}}))
  for(const id of ['locked','target'])$(id).addEventListener('change',()=>{suggestion=null;$('apply-suggestion').disabled=true})
  $('apply-suggestion').addEventListener('click',()=>{if(suggestion){const section=$('locked').value==='foreground'?'background':'foreground';commit({...state.pair,[section]:suggestion.color},true);notice('Suggestion applied.')}})
  $('history-search').addEventListener('input',renderLibrary)
  $('clear-history').addEventListener('click',()=>{state.history=[];persist();renderLibrary();notice('History cleared. Favourites kept.')})
  $('favorite-form').addEventListener('submit',e=>{e.preventDefault();if(state.favorites.length>=200){notice('Maximum 200 favourites. Delete one first.');return}state.favorites.push({...state.pair,name:$('favorite-name').value.trim()||'Untitled',collection:$('favorite-collection').value.trim()});persist();renderLibrary();notice('Favourite saved.')})
  $('analyze-palette').addEventListener('click',safe(()=>{const colors=A.palette($('palette').value);batchRows=A.matrix(colors);$('batch-summary').textContent=`${colors.length} colours; ${batchRows.length} foreground/background combinations; ${batchRows.filter(r=>r.aa).length} pass AA regular text.`;$('batch-results').replaceChildren(...batchRows.map(r=>{const li=document.createElement('li');li.textContent=`${r.foreground} on ${r.background}: ${r.raw.toFixed(4)}:1 — AA ${r.aa?'Pass':'Fail'}`;return li}));$('export-batch').disabled=false;notice($('batch-summary').textContent)}))
  $('palette-file').addEventListener('change',safe(async()=>{const file=$('palette-file').files[0];if(!file)return;if(file.size>16384)throw new Error('Palette file exceeds 16 KB.');const content=await file.text();A.palette(content);$('palette').value=content;batchRows=[];$('export-batch').disabled=true;notice('Palette imported. Choose Analyze all combinations.')}))
  $('palette').addEventListener('input',()=>{batchRows=[];$('export-batch').disabled=true;$('batch-results').replaceChildren();$('batch-summary').textContent='Palette changed; analyze again.'})
  for(const [id,batch]of [['export-current',false],['export-batch',true]])$(id).addEventListener('click',safe(async()=>notice(await window.cca.export(batch?batchRows:[state.pair],$('export-format').value)?'Report exported.':'Export cancelled.')))
  $('screenshot-file').addEventListener('change',safe(()=>loadScreenshot($('screenshot-file').files[0])))
  for(const axis of ['x','y'])$('pixel-'+axis).addEventListener('input',samplePixel)
  $('apply-pixel').addEventListener('click',()=>{if(imageData){commit({...state.pair,[$('pixel-section').value]:pixel.color},true);notice('Applied pixel '+pixel.color)}})
  $('pixel-canvas').addEventListener('keydown',e=>{if(!imageData)return;const step=e.shiftKey?10:1;if(e.key==='Enter'){e.preventDefault();$('apply-pixel').click();return}if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();$('pixel-x').value=pixel.x+(e.key==='ArrowLeft'?-step:e.key==='ArrowRight'?step:0);$('pixel-y').value=pixel.y+(e.key==='ArrowUp'?-step:e.key==='ArrowDown'?step:0);samplePixel()})
  $('pixel-canvas').addEventListener('click',e=>{if(!imageData)return;const rect=e.currentTarget.getBoundingClientRect();$('pixel-x').value=Math.floor((e.clientX-rect.left)/rect.width*imageData.width);$('pixel-y').value=Math.floor((e.clientY-rect.top)/rect.height*imageData.height);samplePixel()})
  for(const lang of Object.keys(loaded.languages)){const option=document.createElement('option');option.value=lang;try{option.textContent=new Intl.DisplayNames([lang],{type:'language'}).of(lang)}catch{option.textContent=lang}$('language').append(option)}
  for(const key of S.ACTIONS){const label=document.createElement('label');label.textContent=shortcutLabels[key];const input=document.createElement('input');input.id='shortcut-'+key;input.maxLength=40;input.autocomplete='off';label.append(input);$('shortcuts').append(label)}
  $('reset-shortcuts').addEventListener('click',()=>{for(const [key,value]of Object.entries(S.defaults().settings.shortcuts))$('shortcut-'+key).value=value})
  $('settings-form').addEventListener('submit',e=>{e.preventDefault();try{state.settings=S.settings({theme:$('theme').value,lang:$('language').value,rounding:Number($('rounding').value),alwaysOnTop:$('always-on-top').checked,shortcuts:Object.fromEntries(S.ACTIONS.map(k=>[k,$('shortcut-'+k).value])),regularTemplate:$('regular-template').value,shortTemplate:$('short-template').value});persist();applySettings();closeDialog('settings-dialog');notice('Preferences saved.')}catch(error){$('settings-error').textContent=error.message}})
  $('version').textContent=`Version ${loaded.version} · Electron 44.3.0 · ${loaded.platform}`
  $('portable-status').textContent=loaded.portable?'Portable mode: preferences stay in the data folder beside CCA.exe.':'Preferences stay in your per-user application-data folder.'
  $('check-updates').addEventListener('click',safe(async()=>{$('update-status').textContent='Checking configured private updates…';try{const result=await window.cca.updates();$('update-status').textContent=result.message;$('download-update').disabled=!result.available}catch(error){$('update-status').textContent=error.message;$('download-update').disabled=true}}))
  $('download-update').addEventListener('click',safe(async()=>{$('download-update').disabled=true;try{$('update-status').textContent=await window.cca.downloadUpdate()?'Verified archive saved. Close CCA and extract it into a new folder to upgrade.':'Download cancelled.'}finally{$('download-update').disabled=false}}))
  window.cca.onAction(safe(action));window.cca.onNotice(notice)
  applySettings();renderLibrary();if(loaded.startupWarning)notice(loaded.startupWarning)
  document.body.dataset.ready='true'
}
init().catch(error=>{notice('CCA could not start: '+error.message);console.error(error)})
