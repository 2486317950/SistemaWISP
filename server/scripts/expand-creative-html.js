const fs = require('fs');
const path = require('path');

const out = path.join(__dirname, '..', 'public-creative', 'index.html');

const html = fs.readFileSync(out, 'utf8');
const start = html.indexOf('  <!-- HERO -->');
const end = html.indexOf('  <!-- FOOTER -->');
if (start < 0 || end < 0) throw new Error('markers not found');

const body = `  <!-- HERO -->
  <section class="relative pt-28 pb-20 md:pt-40 md:pb-28 overflow-hidden">
    <motion class="motion-orb w-[420px] h-[420px] top-[-80px] left-[8%] bg-purple-400/25 dark:bg-purple-500/15"></motion>
    <motion class="motion-orb motion-orb--2 w-[340px] h-[340px] top-[18%] right-[4%] bg-orange-400/20 dark:bg-orange-500/10"></motion>
    <motion class="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-gradient-to-b from-purple-100/50 dark:from-purple-500/5 to-transparent rounded-full blur-3xl pointer-events-none" data-parallax="0.08"></motion>
    <motion class="max-w-6xl mx-auto px-5 relative z-10 grid md:grid-cols-2 gap-10 items-center">
      <motion class="motion-hero">
        <p class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-purple-200 dark:border-purple-500/25 bg-purple-50 dark:bg-purple-500/10 text-xs font-semibold text-purple-700 dark:text-purple-300 mb-5 cdcom-hero-badge">
          <span class="w-2 h-2 rounded-full bg-purple-500 animate-pulse"></span>
          División creativa · Grupo CDCom · La Huerta, Jal.
        </p>
        <h1 class="text-4xl md:text-5xl font-black tracking-tight leading-[1.08] mb-5">
          Marcas que <span class="text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-orange-500">dejan huella</span>
        </h1>
        <p class="text-lg text-gray-500 dark:text-zinc-400 max-w-xl mb-8 leading-relaxed">
          Estrategia, diseño y producción en un solo equipo. Ayudamos a negocios locales y regionales a verse profesionales, comunicar con claridad y crecer en digital.
        </p>
        <motion class="flex flex-wrap gap-3 mb-10">
          <a href="https://wa.me/523151259871?text=Hola%2C%20me%20interesa%20un%20servicio%20de%20branding" target="_blank" class="px-7 py-3.5 rounded-xl bg-gradient-to-r from-purple-600 to-orange-500 text-white font-bold text-sm hover:opacity-90 transition shadow-lg shadow-purple-600/20">Iniciar proyecto</a>
          <a href="#paquetes" class="px-7 py-3.5 rounded-xl border border-gray-300 dark:border-white/10 text-sm font-medium hover:border-purple-500 hover:text-purple-600 dark:hover:text-purple-400 transition">Ver paquetes</a>
        </motion>
        <motion class="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <motion class="cdcom-stat rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/5 p-4 text-center"><div class="text-xl font-bold text-purple-600 dark:text-purple-400">80+</motion><div class="text-[11px] text-gray-500 dark:text-zinc-500 mt-0.5">Proyectos</motion></motion>
          <motion class="cdcom-stat rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/5 p-4 text-center"><div class="text-xl font-bold text-orange-500">6</motion><motion class="text-[11px] text-gray-500 dark:text-zinc-500 mt-0.5">Servicios</motion></motion>
          <motion class="cdcom-stat rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/5 p-4 text-center"><div class="text-xl font-bold text-purple-600 dark:text-purple-400">48h</motion><div class="text-[11px] text-gray-500 dark:text-zinc-500 mt-0.5">Propuesta</motion></motion>
          <motion class="cdcom-stat rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/5 p-4 text-center"><div class="text-xl font-bold text-orange-500">100%</motion><div class="text-[11px] text-gray-500 dark:text-zinc-500 mt-0.5">Editables</motion></motion>
        </motion>
      </motion>
      <motion class="hidden md:block cdcom-hero-visual">
        <img src="https://images.unsplash.com/photo-1561070791-2526d30994b5?w=600&q=80" alt="Diseño creativo" class="motion-float rounded-2xl shadow-2xl w-full h-[380px] object-cover" />
      </motion>
    </motion>
  </section>
`;

// Replace motion tags with div in generated block
const fixed = body.replace(/<motion /g, '<div ').replace(/<\/motion>/g, '</motion>').replace(/<\/motion>/g, '</div>');
const newHtml = html.slice(0, start) + fixed + '\n\n' + html.slice(end);
fs.writeFileSync(out, newHtml.replace(/<link rel="stylesheet" href="\/landing-assets\/cdcom-pro.css" \/>/, '  <link rel="stylesheet" href="/landing-assets/cdcom-pro.css" />'), 'utf8');
console.log('partial hero ok - need full insert');
