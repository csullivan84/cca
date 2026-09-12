const { test } = require('node:test'),
  assert = require('node:assert/strict')
const S = require('../src/core/state.cjs')
test('defaults validate and strip unknown state properties', () => {
  const data = S.defaults()
  data.token = 'should not persist'
  assert.equal(S.validate(data).token, undefined)
  assert.deepEqual(S.validate(data), S.defaults())
})
test('rejects unknown shortcut actions, conflicts and reserved keys', () => {
  const s = S.defaults().settings.shortcuts
  assert.throws(() => S.validateShortcuts({ ...s, read: 'F11' }))
  assert.throws(() => S.validateShortcuts({ ...s, read: 'Alt+F4' }))
  assert.throws(() => S.validateShortcuts({ ...s, read: 'Control+C' }))
  assert.throws(() => S.validateShortcuts({ ...s, exec: 'Alt+X' }))
  assert.throws(() => S.validateShortcuts({ ...s, read: 'Alt+Alt+R' }))
})
test('normalizes modifier ordering', () => {
  const s = S.defaults().settings.shortcuts
  assert.equal(
    S.validateShortcuts({ ...s, read: 'Shift+Alt+R' }).read,
    'Alt+Shift+R'
  )
})
test('bounds recover off-screen windows on mixed-DPI logical displays', () => {
  const d = [
    { workArea: { x: 0, y: 0, width: 1920, height: 1040 } },
    { workArea: { x: -1280, y: 0, width: 1280, height: 720 } }
  ]
  assert.deepEqual(
    S.recoverBounds({ x: 4000, y: 2000, width: 900, height: 700 }, d),
    { x: 1020, y: 340, width: 900, height: 700 }
  )
  const b = S.recoverBounds({ x: -500, y: 600, width: 800, height: 900 }, d)
  assert.ok(b.y + b.height <= 1040)
})
test('small displays bound size and negative origins', () => {
  const d = [{ workArea: { x: -320, y: 0, width: 320, height: 300 } }]
  assert.deepEqual(S.recoverBounds(null, d), {
    x: -320,
    y: 0,
    width: 320,
    height: 300
  })
})
test('bounded history, favorites and payloads', () => {
  const s = S.defaults()
  s.history = new Array(101).fill(s.pair)
  assert.throws(() => S.validate(s))
  s.history = []
  s.settings.regularTemplate = 'x'.repeat(4001)
  assert.throws(() => S.validate(s))
})
test('undo/redo and branch replacement', () => {
  const t = new S.Timeline({ foreground: 'black', background: 'white' })
  t.set({ foreground: 'red', background: 'white' })
  assert.equal(t.undo().foreground, 'black')
  assert.equal(t.redo().foreground, 'red')
  t.undo()
  t.set({ foreground: 'blue', background: 'white' })
  assert.equal(t.future.length, 0)
  assert.equal(t.past.length, 1)
})
test('undo stack is bounded', () => {
  const t = new S.Timeline({ foreground: 'black', background: 'white' })
  for (let i = 0; i < 120; i++)
    t.set({ foreground: `rgb(${i} 0 0)`, background: 'white' })
  assert.equal(t.past.length, 100)
})
