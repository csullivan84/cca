// WCAG 2.2 contrast uses unrounded, linearized sRGB luminance.
const { parse, converter, formatHex, formatHex8 } = require('culori')
const toRgb = converter('rgb')
const toLab = converter('oklab')
const clamp = (n) => Math.max(0, Math.min(1, n))
function color(input) {
  if (typeof input !== 'string' || input.length > 256)
    throw new Error('Enter a CSS colour (up to 256 characters).')
  let parsed = parse(input.trim())
  // Preserve the original app's HSV input, which is not a CSS standard syntax.
  if (!parsed) {
    const m = input.match(
      /^hsva?\(\s*([\d.+-]+)\s*,\s*([\d.+-]+)%\s*,\s*([\d.+-]+)%(?:\s*,\s*([\d.]+))?\s*\)$/i
    )
    if (m)
      parsed = {
        mode: 'hsv',
        h: +m[1],
        s: +m[2] / 100,
        v: +m[3] / 100,
        alpha: m[4] === undefined ? 1 : +m[4]
      }
  }
  if (!parsed)
    throw new Error(
      'Invalid colour. Try #336699, rgb(20 40 60 / 50%), hsl(210 50% 40%), or oklch(60% 0.1 210).'
    )
  const rgb = toRgb(parsed)
  const values = [rgb.r, rgb.g, rgb.b, rgb.alpha ?? 1]
  if (!values.every(Number.isFinite))
    throw new Error(
      'Colour channels must be finite numbers; “none” and relative colours are not supported.'
    )
  const clipped = values.some((n) => n < -0.000001 || n > 1.000001)
  return {
    mode: 'rgb',
    r: clamp(rgb.r),
    g: clamp(rgb.g),
    b: clamp(rgb.b),
    alpha: clamp(rgb.alpha ?? 1),
    clipped
  }
}
function composite(f, b) {
  const a = f.alpha ?? 1
  return {
    mode: 'rgb',
    r: f.r * a + b.r * (1 - a),
    g: f.g * a + b.g * (1 - a),
    b: f.b * a + b.b * (1 - a),
    alpha: 1
  }
}
function luminance(c) {
  const linear = (n) =>
    n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4
  return 0.2126 * linear(c.r) + 0.7152 * linear(c.g) + 0.0722 * linear(c.b)
}
function ratio(f, b) {
  const a = luminance(f),
    z = luminance(b)
  return (Math.max(a, z) + 0.05) / (Math.min(a, z) + 0.05)
}
function classify(raw) {
  return {
    aa: raw >= 4.5,
    aaLarge: raw >= 3,
    aaa: raw >= 7,
    aaaLarge: raw >= 4.5,
    nonText: raw >= 3
  }
}
function analyze(foreground, background) {
  const f = color(foreground),
    b = color(background)
  const backdrop = composite(b, color('#fff'))
  const effective = composite(f, backdrop)
  const raw = ratio(effective, backdrop)
  return {
    foreground,
    background,
    effectiveForeground: formatHex(effective),
    effectiveBackground: formatHex(backdrop),
    raw,
    ...classify(raw),
    clipped: f.clipped || b.clipped,
    alpha: f.alpha,
    backgroundAlpha: b.alpha
  }
}
function format(input, mode) {
  const c = color(input)
  if (mode === 'hex') return c.alpha < 1 ? formatHex8(c) : formatHex(c)
  if (mode === 'rgb')
    return `rgb(${[c.r, c.g, c.b].map((n) => +(n * 255).toFixed(3)).join(' ')} / ${+c.alpha.toFixed(4)})`
  const v = converter(mode)(c)
  if (mode === 'hsl')
    return `hsl(${+(v.h || 0).toFixed(2)} ${(v.s * 100).toFixed(2)}% ${(v.l * 100).toFixed(2)}% / ${c.alpha})`
  if (mode === 'hsv')
    return `hsva(${+(v.h || 0).toFixed(2)}, ${(v.s * 100).toFixed(2)}%, ${(v.v * 100).toFixed(2)}%, ${c.alpha})`
  throw new Error('Unsupported colour format')
}
function suggest(foreground, background, locked, target) {
  if (
    !['foreground', 'background'].includes(locked) ||
    ![3, 4.5, 7].includes(target)
  )
    throw new Error('Invalid suggestion settings')
  const changing = locked === 'foreground' ? background : foreground
  const source = color(changing),
    lab = toLab(source)
  if (analyze(foreground, background).raw >= target)
    return { color: changing, distance: 0 }
  let best
  // Search 2,050 candidates along black/white blends; not a global gamut optimizer.
  for (const endpoint of [0, 1])
    for (let step = 0; step <= 1024; step++) {
      const t = step / 1024
      const candidate = {
        mode: 'rgb',
        r: source.r * (1 - t) + endpoint * t,
        g: source.g * (1 - t) + endpoint * t,
        b: source.b * (1 - t) + endpoint * t,
        alpha: source.alpha
      }
      const css = format(
        candidate.alpha < 1 ? formatHex8(candidate) : formatHex(candidate),
        'hex'
      )
      const result =
        locked === 'foreground'
          ? analyze(foreground, css)
          : analyze(css, background)
      if (result.raw < target) continue
      const next = toLab(color(css)),
        distance = Math.hypot(next.l - lab.l, next.a - lab.a, next.b - lab.b)
      if (!best || distance < best.distance)
        best = { color: css, distance, raw: result.raw }
    }
  return best || null
}
function palette(text) {
  if (typeof text !== 'string' || text.length > 16384)
    throw new Error('Palette exceeds 16 KB.')
  let items
  if (text.trim().startsWith('[')) {
    items = JSON.parse(text)
    if (!Array.isArray(items))
      throw new Error('Use a JSON array of colour strings.')
  } else
    items = text
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean)
  if (items.length < 2 || items.length > 32)
    throw new Error('Supply 2–32 colours, one per line or as a JSON array.')
  items.forEach(color)
  return [...new Set(items)]
}
function matrix(items) {
  return items.flatMap((f, i) =>
    items.filter((_, j) => i !== j).map((b) => analyze(f, b))
  )
}
function report(rows, type) {
  if (!Array.isArray(rows) || rows.length > 1024)
    throw new Error('Too many report rows')
  const data = rows.map((r) => analyze(r.foreground, r.background))
  const note =
    'WCAG 2.2 colour contrast only; not a complete accessibility conformance evaluation. Transparent backgrounds are composited on white. Pass/fail uses unrounded sRGB ratios.'
  if (type === 'json')
    return JSON.stringify(
      { standard: 'WCAG 2.2', note, results: data },
      null,
      2
    )
  const pass = (b) => (b ? 'Pass' : 'Fail')
  if (type === 'csv') {
    const quote = (s) => '"' + String(s).replaceAll('"', '""') + '"'
    return (
      '\ufeff' +
      [
        [
          'Foreground',
          'Background',
          'Ratio',
          'AA text',
          'AA large',
          'AAA text',
          'AAA large',
          'Non-text'
        ],
        ...data.map((r) => [
          r.foreground,
          r.background,
          r.raw,
          pass(r.aa),
          pass(r.aaLarge),
          pass(r.aaa),
          pass(r.aaaLarge),
          pass(r.nonText)
        ])
      ]
        .map((row) => row.map(quote).join(','))
        .join('\r\n') +
      '\r\n'
    )
  }
  const lines = data.map(
    (r) =>
      `Foreground: ${r.foreground}; Background: ${r.background}; Contrast: ${r.raw}:1; AA: ${pass(r.aa)}; AA large: ${pass(r.aaLarge)}; AAA: ${pass(r.aaa)}; AAA large: ${pass(r.aaaLarge)}; Non-text: ${pass(r.nonText)}`
  )
  if (type === 'txt') return [note, ...lines].join('\r\n\r\n')
  if (type === 'html') {
    const esc = (s) =>
      s
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
    return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>CCA contrast report</title><main><h1>CCA contrast report</h1><p>${note}</p><ol>${lines.map((s) => `<li><p>${esc(s)}</p></li>`).join('')}</ol></main></html>`
  }
  throw new Error('Unsupported report format')
}
module.exports = {
  color,
  composite,
  luminance,
  ratio,
  classify,
  analyze,
  format,
  suggest,
  palette,
  matrix,
  report
}
