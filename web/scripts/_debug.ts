const LEAK_RE = /^\s*([\u1369-\u137C]+|[\u00B2\u00B3\u00B9\u2070\u2074-\u2079]+|\d+)/;
const txt = "¹አምላክም ኖኅንና";
console.log('codepoint of first char:', txt.charCodeAt(0).toString(16));
const m = txt.match(LEAK_RE);
console.log('match:', m);
