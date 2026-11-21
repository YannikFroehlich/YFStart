'use strict';

// Rechner für das Suchfeld: + - * / ^, Klammern, Komma oder Punkt als Dezimalzeichen, dazu × ÷ : ·
// und √/sqrt/wurzel sowie pi. Ohne eval (das verbietet Chrome auf Extension-Seiten ohnehin).
// Gibt das Ergebnis zurück oder null, wenn der Text keine Rechnung ist ("42" allein ist keine).
function calc(text) {
  const src = text.toLowerCase().replace(/\s+/g, '')
    .replace(/[×·]/g, '*').replace(/[÷:]/g, '/').replace(/\*\*/g, '^').replace(/,/g, '.')
    .replace(/wurzel|sqrt/g, '√').replace(/pi/g, 'π');
  if (!/^[\d.+\-*/^()√π]+$/.test(src) || !/[\d)π][+\-*/^]|√/.test(src)) return null;
  if (/^\d{4}-\d\d?-\d\d?$/.test(src)) return null; // Datum, keine Rechnung
  let i = 0;
  const eat = ch => (src[i] === ch ? (i++, true) : false);

  function expr() {
    let v = term();
    for (;;) {
      if (eat('+')) v += term();
      else if (eat('-')) v -= term();
      else return v;
    }
  }
  function term() {
    let v = unary();
    for (;;) {
      if (eat('*')) v *= unary();
      else if (eat('/')) v /= unary();
      else return v;
    }
  }
  function unary() { // -2^2 = -4 wie in der Mathematik
    if (eat('-')) return -unary();
    if (eat('+')) return unary();
    if (eat('√')) return Math.sqrt(unary());
    return power();
  }
  function power() {
    const base = primary();
    return eat('^') ? base ** unary() : base; // 2^3^2 = 2^9
  }
  function primary() {
    if (eat('(')) {
      const v = expr();
      if (!eat(')')) throw new Error();
      return v;
    }
    if (eat('π')) return Math.PI;
    const m = /^(\d+\.?\d*|\.\d+)/.exec(src.slice(i));
    if (!m) throw new Error();
    i += m[0].length;
    return Number(m[0]);
  }

  try {
    const v = expr();
    return i === src.length && Number.isFinite(v) ? v : null;
  } catch {
    return null;
  }
}

if (typeof module !== 'undefined') module.exports = calc; // für calc.test.js (node)
