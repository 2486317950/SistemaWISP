/**
 * Aplica animaciones CDCom a landings estáticas.
 * node server/scripts/patch-landing-motion.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const FILES = [
  'public-main/index.html',
  'public-site/index.html',
  'public-systems/index.html',
  'public-creative/index.html',
  'public-energy/index.html',
];

const STYLE_BLOCK = /  <style>[\s\S]*?\.fade-in[\s\S]*?<\/style>\s*\n/;
const LINK = '  <link rel="stylesheet" href="/landing-assets/cdcom-motion.css" />\n';
const MOTION_SCRIPT = '  <script src="/landing-assets/cdcom-motion.js"></script>\n';
const FADE_OBSERVER =
  /\s*const fadeEls = document\.querySelectorAll\([^)]+\);[\s\S]*?fadeEls\.forEach\([^)]+\);\s*/g;

const ORBS = {
  main: ['bg-blue-400/30 dark:bg-blue-500/20', 'bg-cyan-400/25 dark:bg-cyan-500/15'],
  internet: ['bg-blue-400/30 dark:bg-blue-500/20', 'bg-cyan-400/20 dark:bg-cyan-500/10'],
  systems: ['bg-cyan-400/30 dark:bg-cyan-500/15', 'bg-blue-400/20 dark:bg-blue-500/10'],
  creative: ['bg-purple-400/25 dark:bg-purple-500/15', 'bg-orange-400/20 dark:bg-orange-500/10'],
  energy: ['bg-amber-400/30 dark:bg-amber-500/20', 'bg-orange-400/20 dark:bg-orange-500/10'],
};

function themeKey(rel) {
  if (rel.includes('main')) return 'main';
  if (rel.includes('site')) return 'internet';
  if (rel.includes('systems')) return 'systems';
  if (rel.includes('creative')) return 'creative';
  return 'energy';
}

function orbBlock(colors) {
  const [o1, o2] = colors;
  const lines = [
    '    <motion class="motion-orb w-[420px] h-[420px] top-[-80px] left-[8%] ' + o1 + '">',
    '    <motion class="motion-orb motion-orb--2 w-[340px] h-[340px] top-[18%] right-[4%] ' + o2 + '">',
  ];
  return lines.join('\n').replace(/<motion /g, '<div ').replace(/>$/gm, '></div>');
}

function patchFile(rel) {
  const full = path.join(ROOT, rel);
  let html = fs.readFileSync(full, 'utf8');
  const colors = ORBS[themeKey(rel)];

  if (!html.includes('cdcom-motion.css')) {
    if (STYLE_BLOCK.test(html)) html = html.replace(STYLE_BLOCK, LINK);
    else html = html.replace('</script>\n</head>', `</script>\n${LINK}</head>`);
  }

  html = html.replace(/\bfade-in\b/g, 'motion-reveal');
  html = html.replace(FADE_OBSERVER, '\n');

  if (!html.includes('cdcom-motion.js')) {
    html = html.replace(/(\s*<script>\s*\n\s*document\.getElementById\('yr'\))/, `${MOTION_SCRIPT}$1`);
  }

  if (!html.includes('motion-orb w-[420px]')) {
    html = html.replace(
      /(<section class="relative pt-[^"]+overflow-hidden">\s*\n)(\s*<div class="absolute top-0 left-1\/2)/,
      `$1${orbBlock(colors)}\n$2`
    );
  }

  if (!html.includes('data-parallax')) {
    html = html.replace(/pointer-events-none"><\/div>/, 'pointer-events-none" data-parallax="0.08"></motion>');
    html = html.replace(/pointer-events-none" data-parallax="0\.08"><\/motion>/, 'pointer-events-none" data-parallax="0.08"></div>');
  }

  html = html.replace(
    /(<div class="max-w-6xl mx-auto px-5(?: relative z-10)? grid md:grid-cols-2 gap-10 items-center(?: relative z-10)?">\s*\n\s*)<div>(?!\s*class="motion-hero")/,
    '$1<div class="motion-hero">'
  );

  html = html.replace(/class="rounded-2xl shadow-2xl/g, 'class="motion-float rounded-2xl shadow-2xl');
  html = html.replace(/motion-float motion-float/g, 'motion-float');
  html = html.replace(
    /class="relative hidden md:block(?! motion-reveal-right)"/g,
    'class="relative hidden md:block motion-reveal-right"'
  );

  html = html.replace(/<div class="grid (md:grid-cols-3 gap-4)">/g, '<div class="grid $1 motion-stagger">');
  html = html.replace(/<div class="grid (md:grid-cols-2 lg:grid-cols-4 gap-5)">/g, '<div class="grid $1 motion-stagger">');
  html = html.replace(/ motion-stagger motion-stagger/g, ' motion-stagger');

  html = html.replace(/class="group rounded-2xl bg-gray-50/g, 'class="motion-card-shine group rounded-2xl bg-gray-50');
  html = html.replace(
    /class="rounded-xl bg-gray-50 dark:bg-white\/\[0\.03\] border border-gray-100 dark:border-white\/5 p-6 hover:border/g,
    'class="motion-card-shine rounded-xl bg-gray-50 dark:bg-white/[0.03] border border-gray-100 dark:border-white/5 p-6 hover:border'
  );
  html = html.replace(/motion-card-shine motion-card-shine/g, 'motion-card-shine');

  html = html.replace(/<\/?motion>/gi, (m) => (m.startsWith('</') ? '</div>' : '<div>'));

  fs.writeFileSync(full, html, 'utf8');
  console.log('OK', rel);
}

for (const f of FILES) patchFile(f);
