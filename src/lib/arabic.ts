export function normalizeArabic(text: string): string {
  if (typeof text !== 'string') return ''
  let s = text.trim()
  s = s.replace(/\u0640/g, '')
  s = s.replace(/[\u064B-\u0652\u0670]/g, '')
  s = s.replace(/[\u0623\u0625\u0622]/g, '\u0627')
  s = s.replace(/\s+/g, ' ').trim()
  return s
}
