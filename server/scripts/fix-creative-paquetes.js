const fs = require('fs');
const path = require('path');

const D = 'd' + 'iv';
const file = path.join(__dirname, '..', 'public-creative', 'index.html');
let html = fs.readFileSync(file, 'utf8');

const start = html.indexOf('  <!-- PAQUETES -->');
const end = html.indexOf('  <!-- POR QUÉ CDCom -->');
if (start < 0 || end < 0) throw new Error('markers not found');

const lines = [];
const w = (s) => lines.push(s);

w('  <!-- PAQUETES -->');
w('  <section id="paquetes" class="py-20 md:py-28 border-t border-gray-100 dark:border-white/5">');
w(`    <${D} class="max-w-6xl mx-auto px-5">`);
w(`      <${D} class="text-center mb-14 motion-reveal">`);
w('        <p class="cdcom-section-label text-xs font-semibold tracking-widest uppercase text-purple-600 dark:text-purple-400 mb-3">Paquetes</p>');
w('        <h2 class="cdcom-section-title text-3xl md:text-4xl font-bold tracking-tight mb-4">Opciones para arrancar</h2>');
w('        <p class="cdcom-section-desc text-gray-500 dark:text-zinc-400 max-w-2xl mx-auto">Precios orientativos; el cotizador final depende de alcance y plazos. Todos incluyen asesoría inicial sin costo.</p>');
w(`      </${D}>`);
w(`      <${D} class="grid md:grid-cols-3 gap-6 lg:gap-8 cdcom-pack-grid motion-stagger">`);

function packCard({ badge, title, sub, items, featured, waText }) {
  const border = featured
    ? 'border-2 border-purple-300 dark:border-purple-500/40 p-7 shadow-md shadow-purple-500/10'
    : 'border border-gray-100 dark:border-white/5 p-7';
  const btn = featured
    ? 'bg-gradient-to-r from-purple-600 to-orange-500 text-white'
    : 'border border-gray-300 dark:border-white/10 hover:border-purple-500';
  w(`        <article class="motion-card-shine cdcom-pack-card relative rounded-2xl bg-gray-50 dark:bg-white/[0.03] ${border}">`);
  if (badge) w(`          <span class="cdcom-pack-badge">${badge}</span>`);
  w(`          <h3 class="font-bold text-lg mb-1">${title}</h3>`);
  w(`          <p class="text-xs text-gray-500 dark:text-zinc-400 mb-4">${sub}</p>`);
  w('          <ul class="cdcom-pack-list space-y-2">');
  items.forEach((item) => {
    w(`            <li class="flex gap-2 text-sm text-gray-600 dark:text-zinc-300"><span class="text-purple-500 shrink-0">✓</span>${item}</li>`);
  });
  w('          </ul>');
  w(`          <a href="https://wa.me/523151259871?text=${encodeURIComponent(waText)}" target="_blank" rel="noopener" class="cdcom-pack-cta block text-center py-2.5 rounded-lg text-sm font-semibold ${btn} transition">Solicitar cotización</a>`);
  w('        </article>');
}

packCard({
  title: 'Esencial',
  sub: 'Ideal para negocios que inician su imagen',
  items: ['Logo + variantes', 'Paleta y tipografías', 'Tarjeta y redes básicas', '1 ronda de cambios'],
  waText: 'Hola, me interesa el paquete Esencial de CDCom Creative',
});
packCard({
  badge: 'Recomendado',
  title: 'Profesional',
  sub: 'Marca completa + presencia digital',
  featured: true,
  items: ['Manual de marca PDF', '12 piezas para redes', 'Landing de 1 página', 'Sesión foto (½ día)', '2 rondas de cambios'],
  waText: 'Hola, me interesa el paquete Profesional de CDCom Creative',
});
packCard({
  title: 'Premium',
  sub: 'Lanzamiento integral',
  items: ['Todo lo Profesional', 'Video reel + corporativo', 'Campaña Meta 1 mes*', 'Sitio multi-sección', 'Soporte 30 días'],
  waText: 'Hola, me interesa el paquete Premium de CDCom Creative',
});

w(`      </${D}>`);
w('      <p class="text-center text-xs text-gray-400 mt-8 max-w-xl mx-auto leading-relaxed">* Presupuesto de pauta publicitaria no incluido. Cotización personalizada en 48 h hábiles.</p>');
w(`    </${D}>`);
w('  </section>');
w('');

html = html.slice(0, start) + lines.join('\n') + html.slice(end);
fs.writeFileSync(file, html, 'utf8');
console.log('Paquetes section fixed');
