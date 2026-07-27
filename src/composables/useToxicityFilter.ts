const TOXIC_PATTERNS: RegExp[] = [
  /n[i1l]gg[ea3]r?s?/i,
  /n[i1l]gg?a?s?/i,
  /r[ e]t[a4r]rd/i,
  /f[a4]gg[o0]t/i,
  /\bk[i1l]ll\s+(?:all\s+)?(?:yo?u?r?s?el[fv]|youself|ur[s]?elf|them|everyone|n[i1]gg[ea]r)/i,
  /\b(?:go\s+)?k[i1]ll\s+youself\b/i,
  /\bsu[i1]c[i1]de\b/i,
  /\bra[pe3]ist?\b/i,
  /\bsp[i1]c[o0]?n?[e3]?r?d?/i,
];

const TOXIC_EXACT: string[] = [
  'nigger', 'nigga', 'nigg3r', 'n1gger', 'n1gga',
  'faggot', 'fagot', 'fag',
  'retard', 'retarted',
  'kill yourself', 'kys', 'k y s',
  'die',
];

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[\s]+/g, ' ')
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .trim();
}

export function isToxic(content: string): boolean {
  if (!content || !content.trim()) return false;
  const norm = normalize(content);
  if (!norm) return false;
  for (const pattern of TOXIC_PATTERNS) {
    if (pattern.test(norm)) return true;
  }
  const words = norm.split(/\s+/);
  for (const word of words) {
    if (TOXIC_EXACT.includes(word)) return true;
  }
  return false;
}

export function useToxicityFilter() {
  return { isToxic };
}
