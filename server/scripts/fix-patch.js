const fs = require('fs');
const p = require('path').join(__dirname, 'patch-landing-motion.js');
let s = fs.readFileSync(p, 'utf8');
const D = 'd' + 'iv';
s = s.replace(
  /function orbBlock[\s\S]*?^}/m,
  `function orbBlock(colors) {
  const [o1, o2] = colors;
  return [
    '    <${D} class="motion-orb w-[420px] h-[420px] top-[-80px] left-[8%] ' + o1 + '"></${D}>',
    '    <${D} class="motion-orb motion-orb--2 w-[340px] h-[340px] top-[18%] right-[4%] ' + o2 + '"></${D}>',
  ].join('\\n');
}`
);
s = s.replace(
  /if \(!html\.includes\('data-parallax'\)\) \{[\s\S]*?\}/,
  `if (!html.includes('data-parallax')) {
    html = html.replace(/pointer-events-none"><\\/${D}>/, 'pointer-events-none" data-parallax="0.08"></${D}>');
  }`
);
s = s.replace(/html = html\.replace\(<\/?motion>/gi[\s\S]*?\);\n\n/, '');
fs.writeFileSync(p, s);
