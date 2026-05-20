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

const PRO_LINK = '  <link rel="stylesheet" href="/landing-assets/cdcom-pro.css" />\n';

function patch(html) {
  if (!html.includes('cdcom-pro.css')) {
    html = html.replace(
      '<link rel="stylesheet" href="/landing-assets/cdcom-motion.css" />',
      '<link rel="stylesheet" href="/landing-assets/cdcom-motion.css" />\n' + PRO_LINK.trim()
    );
  }

  html = html.replace(/<body class="([^"]*)"/, (m, cls) => {
    if (cls.includes('cdcom-site')) return m;
    return `<body class="cdcom-site ${cls}"`;
  });

  html = html.replace(
    /class="inline-flex items-center gap-2 px-3 py-1\.5 rounded-full[^"]*motion-badge-pulse"/g,
    (m) => m.replace('motion-badge-pulse', 'motion-badge-pulse cdcom-hero-badge')
  );

  html = html.replace(
    'class="relative hidden md:block motion-reveal-right"',
    'class="relative hidden md:block motion-reveal-right cdcom-hero-visual"'
  );
  html = html.replace(
    'class="hidden md:block"',
    'class="hidden md:block cdcom-hero-visual"'
  );

  html = html.replace(
    /<p class="text-xs font-semibold tracking-widest uppercase([^"]*) mb-2">/g,
    '<p class="cdcom-section-label text-xs font-semibold tracking-widest uppercase$1 mb-2">'
  );
  html = html.replace(
    /<p class="text-xs font-semibold tracking-widest uppercase([^"]*) mb-3">/g,
    '<p class="cdcom-section-label text-xs font-semibold tracking-widest uppercase$1 mb-3">'
  );

  html = html.replace(
    /<h2 class="text-3xl md:text-4xl font-bold tracking-tight">/g,
    '<h2 class="cdcom-section-title text-3xl md:text-4xl font-bold tracking-tight">'
  );
  html = html.replace(
    /<h2 class="text-2xl md:text-3xl font-bold tracking-tight mb-3">/g,
    '<h2 class="cdcom-section-title text-2xl md:text-3xl font-bold tracking-tight mb-3">'
  );

  html = html.replace(
    /<p class="text-gray-500 dark:text-zinc-400 max-w-lg text-\[15px\]">/g,
    '<p class="cdcom-section-desc text-gray-500 dark:text-zinc-400 max-w-lg text-[15px]">'
  );
  html = html.replace(
    /<p class="text-gray-500 dark:text-zinc-400 max-w-lg mx-auto">/g,
    '<p class="cdcom-section-desc text-gray-500 dark:text-zinc-400 max-w-lg mx-auto">'
  );

  html = html.replace(
    /class="rounded-2xl bg-gray-50 dark:bg-white\/\[0\.03\] border border-gray-100 dark:border-white\/5 p-7"/g,
    'class="cdcom-panel rounded-2xl bg-gray-50 dark:bg-white/[0.03] border border-gray-100 dark:border-white/5 p-7"'
  );

  html = html.replace(
    /class="rounded-xl bg-gray-50 dark:bg-white\/5 border border-gray-100 dark:border-white\/5 p-4 text-center"/g,
    'class="cdcom-stat rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/5 p-4 text-center"'
  );
  html = html.replace(
    /class="rounded-2xl bg-gray-50 dark:bg-white\/5 border border-gray-100 dark:border-white\/5 p-5 text-center"/g,
    'class="cdcom-stat rounded-2xl bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/5 p-5 text-center"'
  );

  html = html.replace(
    /class="rounded-3xl bg-gradient-to-br([^"]+) p-12 md:p-16"/g,
    'class="cdcom-cta-box rounded-3xl bg-gradient-to-br$1 p-12 md:p-16"'
  );
  html = html.replace(
    /class="rounded-2xl bg-gradient-to-br([^"]+) border[^"]+ p-10 md:p-14"/g,
    'class="cdcom-cta-box rounded-2xl bg-gradient-to-br$1 border p-10 md:p-14"'
  );

  return html;
}

for (const f of FILES) {
  const full = path.join(ROOT, f);
  const out = patch(fs.readFileSync(full, 'utf8'));
  fs.writeFileSync(full, out, 'utf8');
  console.log('OK', f);
}
