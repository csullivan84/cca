const { app, BrowserWindow } = require('electron')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'cca-smoke-'))
app.setPath('appData', profile)
app.setPath('userData', profile)
app.setPath('logs', path.join(profile, 'logs'))
let failed = false
const timer = setTimeout(() => { console.error('Smoke test timed out'); app.exit(1) }, 20000)
app.on('web-contents-created', (_, contents) => {
    contents.on('preload-error', (_, __, error) => { failed = true; console.error(error) })
    contents.on('render-process-gone', (_, details) => { failed = true; console.error(details) })
    contents.on('did-fail-load', (_, code, description) => { failed = true; console.error(code, description) })
    contents.on('did-finish-load', async () => {
        try {
            await new Promise(resolve => setTimeout(resolve, 1500))
            const result = await contents.executeJavaScript(`({title: document.title, inputs: document.querySelectorAll('input').length, text: document.body.innerText})`)
            if (result.inputs < 2 || !result.text.includes('Contrast')) throw new Error('Main UI did not render')
            console.log('SMOKE PASS', process.versions.electron, result.title, result.inputs)
        } catch (error) { failed = true; console.error(error) }
        clearTimeout(timer)
        app.exit(failed ? 1 : 0)
    })
})
require('../src/main.js')
