// node calc.test.js
const assert = require('node:assert');
const calc = require('./calc.js');

const cases = [
  ['17*23', 391], ['1+2*3', 7], ['(1+2)*3', 9], ['2^3^2', 512], ['-2^2', -4], ['10 / 4', 2.5],
  ['1,5 + 1,5', 3], ['7 × 6', 42], ['9:3', 3], ['√16 + 1', 5], ['wurzel(2)*wurzel(2)', 2.0000000000000004],
  ['2*pi', 2 * Math.PI], ['-(3-5)', 2], ['.5*4', 2],
];
for (const [input, want] of cases) assert.strictEqual(calc(input), want, input);

for (const input of ['42', '-5', 'hallo', '1+', '(1+2', '1/0', 'youtube.com', 'c++', '2024-11-21', '']) {
  assert.strictEqual(calc(input), null, input);
}
console.log('calc ok');
