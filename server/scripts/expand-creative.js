const fs = require('fs');
const path = require('path');

const D = 'd' + 'iv';
const file = path.join(__dirname, '..', 'public-creative', 'index.html');
let html = fs.readFileSync(file, 'utf8');

const tag = (cls, inner) => `<${D} class="${cls}">${inner}</${D}>`;

const middle = `
  <!-- HERO -->
  <section class="relative pt-28 pb-20 md:pt-40 md:pb-28 overflow-hidden">
    <${D} class="motion-orb w-[420px] h-[420px] top-[-80px] left-[8%] bg-purple-400/25 dark:bg-purple-500/15"></${D}>
    <${D} class="motion-orb motion-orb--2 w-[340px] h-[340px] top-[18%] right-[4%] bg-orange-400/20 dark:bg-orange-500/10"></${D}>
    <${D} class="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-gradient-to-b from-purple-100/50 dark:from-purple-500/5 to-transparent rounded-full blur-3xl pointer-events-none" data-parallax="0.08"></${D}>
    <${D} class="max-w-6xl mx-auto px-5 relative z-10 grid md:grid-cols-2 gap-10 items-center">
      <${D} class="motion-hero">
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
        <${D} class="flex flex-wrap gap-3 mb-10">
          <a href="https://wa.me/523151259871?text=Hola%2C%20me%20interesa%20un%20servicio%20de%20branding" target="_blank" class="px-7 py-3.5 rounded-xl bg-gradient-to-r from-purple-600 to-orange-500 text-white font-bold text-sm hover:opacity-90 transition shadow-lg shadow-purple-600/20">Iniciar proyecto</a>
          <a href="#paquetes" class="px-7 py-3.5 rounded-xl border border-gray-300 dark:border-white/10 text-sm font-medium hover:border-purple-500 hover:text-purple-600 dark:hover:text-purple-400 transition">Ver paquetes</a>
        </${D}>
        <${D} class="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <${D} class="cdcom-stat rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/5 p-4 text-center"><${D} class="text-xl font-bold text-purple-600 dark:text-purple-400">80+</${D}><${D} class="text-[11px] text-gray-500 dark:text-zinc-500 mt-0.5">Proyectos</${D}></${D}>
          <${D} class="cdcom-stat rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/5 p-4 text-center"><${D} class="text-xl font-bold text-orange-500">6</${D}><${D} class="text-[11px] text-gray-500 dark:text-zinc-500 mt-0.5">Servicios</${D}></${D}>
          <${D} class="cdcom-stat rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/5 p-4 text-center"><${D} class="text-xl font-bold text-purple-600 dark:text-purple-400">48h</${D}><${D} class="text-[11px] text-gray-500 dark:text-zinc-500 mt-0.5">Propuesta</${D}></${D}>
          <${D} class="cdcom-stat rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/5 p-4 text-center"><${D} class="text-xl font-bold text-orange-500">100%</${D}><${D} class="text-[11px] text-gray-500 dark:text-zinc-500 mt-0.5">Editables</${D}></${D}>
        </${D}>
      </${D}>
      <${D} class="hidden md:block cdcom-hero-visual">
        <img src="https://images.unsplash.com/photo-1561070791-2526d30994b5?w=600&q=80" alt="Diseño creativo" class="motion-float rounded-2xl shadow-2xl w-full h-[380px] object-cover" />
      </${D}>
    </${D}>
  </section>

  <!-- SERVICIOS -->
  <section id="servicios" class="py-20 md:py-28 motion-reveal border-t border-gray-100 dark:border-white/5">
    <${D} class="max-w-6xl mx-auto px-5">
      <${D} class="text-center mb-14">
        <p class="cdcom-section-label text-xs font-semibold tracking-widest uppercase text-purple-600 dark:text-purple-400 mb-3">Servicios creativos</p>
        <h2 class="cdcom-section-title text-3xl md:text-4xl font-bold tracking-tight mb-4">Todo lo que tu marca necesita</h2>
        <p class="cdcom-section-desc text-gray-500 dark:text-zinc-400 max-w-2xl mx-auto">Desde el concepto hasta la publicación: identidad, contenido, web y campañas con la misma línea visual.</p>
      </${D}>
      <${D} class="grid md:grid-cols-2 lg:grid-cols-3 gap-5 motion-stagger">
        ${serviceCard('🎨', 'Branding & identidad', 'Logo, paleta, tipografías, papelería y manual de marca para uso interno y externo.', ['Naming y claim', 'Logo + variantes', 'Manual PDF', 'Archivos editables'])}
        ${serviceCard('📸', 'Producción audiovisual', 'Contenido que vende: producto, instalaciones, equipo y testimonios.', ['Foto profesional', 'Video corporativo', 'Reels verticales', 'Edición y color'])}
        ${serviceCard('📱', 'Social media', 'Presencia constante y coherente en redes sin perder tiempo en diseño diario.', ['Calendario mensual', 'Plantillas reutilizables', 'Copys sugeridos', 'Reporte básico'])}
        ${serviceCard('🎯', 'Campañas digitales', 'Anuncios en Meta y Google orientados a leads, mensajes o visitas a tu negocio.', ['Configuración de píxeles', 'Creativos A/B', 'Segmentación local', 'Optimización'])}
        ${serviceCard('🌐', 'Diseño web', 'Sitios rápidos, responsivos y alineados a tu marca; integración con WhatsApp y formularios.', ['Landing de conversión', 'Sitio corporativo', 'Catálogo o menú', 'SEO básico on-page'])}
        ${serviceCard('✏️', 'Copywriting', 'Mensajes claros para web, anuncios, fichas de producto y correos.', ['Tono de voz', 'Textos de venta', 'Guiones de video', 'Emails'])}
      </${D}>
    </${D}>
  </section>

  <!-- PROCESO -->
  <section id="proceso" class="py-20 md:py-28 motion-reveal border-t border-gray-100 dark:border-white/5">
    <${D} class="max-w-6xl mx-auto px-5">
      <${D} class="mb-14">
        <p class="cdcom-section-label text-xs font-semibold tracking-widest uppercase text-purple-600 dark:text-purple-400 mb-3">Cómo trabajamos</p>
        <h2 class="cdcom-section-title text-2xl md:text-3xl font-bold tracking-tight mb-3">Proceso creativo en 4 etapas</h2>
        <p class="cdcom-section-desc text-gray-500 dark:text-zinc-400 max-w-lg text-[15px]">Metodología clara, entregables definidos y comunicación directa por WhatsApp en cada fase.</p>
      </${D}>
      <${D} class="grid md:grid-cols-4 gap-4 motion-stagger">
        ${stepCard('01', 'Brief y estrategia', 'Entendemos tu negocio, competencia y objetivos. Definimos público, mensaje y prioridades.')}
        ${stepCard('02', 'Concepto y diseño', 'Moodboards, propuestas visuales y hasta 2 rondas de ajustes incluidas.')}
        ${stepCard('03', 'Producción', 'Ejecutamos piezas finales: impresos, digital, foto, video o desarrollo web.')}
        ${stepCard('04', 'Entrega y soporte', 'Archivos organizados, guía de uso y acompañamiento post-lanzamiento.')}
      </${D}>
    </${D}>
  </section>

  <!-- PARA QUIÉN -->
  <section id="clientes" class="py-20 md:py-28 motion-reveal border-t border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-white/[0.02]">
    <${D} class="max-w-6xl mx-auto px-5">
      <${D} class="text-center mb-14">
        <p class="cdcom-section-label text-xs font-semibold tracking-widest uppercase text-purple-600 dark:text-purple-400 mb-3">Sectores</p>
        <h2 class="cdcom-section-title text-3xl md:text-4xl font-bold tracking-tight mb-4">Trabajamos con marcas de la región</h2>
        <p class="cdcom-section-desc text-gray-500 dark:text-zinc-400 max-w-2xl mx-auto">Experiencia con comercios, servicios y empresas que necesitan verse grandes aunque operen localmente.</p>
      </${D}>
      <${D} class="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 motion-stagger">
        ${sectorCard('🏪', 'Comercio y retail', 'Tiendas, ferreterías, abarrotes y franquicias locales.')}
        ${sectorCard('🍽️', 'Restaurantes y cafés', 'Menús, redes, promociones y fotografía de platillos.')}
        ${sectorCard('📡', 'Tecnología y telecom', 'ISPs, integradores y marcas tech del ecosistema CDCom.')}
        ${sectorCard('🏗️', 'Servicios profesionales', 'Clínicas, talleres, inmobiliarias y oficinas.')}
      </${D}>
    </${D}>
  </section>

  <!-- PAQUETES -->
  <section id="paquetes" class="py-20 md:py-28 motion-reveal border-t border-gray-100 dark:border-white/5">
    <${D} class="max-w-6xl mx-auto px-5">
      <${D} class="text-center mb-14">
        <p class="cdcom-section-label text-xs font-semibold tracking-widest uppercase text-purple-600 dark:text-purple-400 mb-3">Paquetes</p>
        <h2 class="cdcom-section-title text-3xl md:text-4xl font-bold tracking-tight mb-4">Opciones para arrancar</h2>
        <p class="cdcom-section-desc text-gray-500 dark:text-zinc-400 max-w-2xl mx-auto">Precios orientativos; el cotizador final depende de alcance y plazos. Todos incluyen asesoría inicial sin costo.</p>
      </${D}>
      <${D} class="grid md:grid-cols-3 gap-5 motion-stagger">
        ${packCard('Esencial', 'Ideal para negocios que inician su imagen', ['Logo + variantes', 'Paleta y tipografías', 'Tarjeta y redes básicas', '1 ronda de cambios'], false)}
        ${packCard('Profesional', 'Marca completa + presencia digital', ['Manual de marca PDF', '12 piezas para redes', 'Landing de 1 página', 'Sesión foto (½ día)', '2 rondas de cambios'], true)}
        ${packCard('Premium', 'Lanzamiento integral', ['Todo lo Profesional', 'Video reel + corporativo', 'Campaña Meta 1 mes*', 'Sitio multi-sección', 'Soporte 30 días'], false)}
      </${D}>
      <p class="text-center text-xs text-gray-400 mt-6">* Presupuesto de pauta publicitaria no incluido. Cotización personalizada en 48 h hábiles.</p>
    </${D}>
  </section>

  <!-- POR QUÉ CDCom -->
  <section id="porque" class="py-20 md:py-28 motion-reveal border-t border-gray-100 dark:border-white/5">
    <${D} class="max-w-6xl mx-auto px-5 grid md:grid-cols-2 gap-10 items-center">
      <${D}>
        <p class="cdcom-section-label text-xs font-semibold tracking-widest uppercase text-purple-600 dark:text-purple-400 mb-3">Ventajas</p>
        <h2 class="cdcom-section-title text-2xl md:text-3xl font-bold tracking-tight mb-4">Por qué CDCom Creative</h2>
        <ul class="space-y-4 text-[15px] text-gray-600 dark:text-zinc-300">
          <li class="flex gap-3"><span class="text-purple-500 font-bold">✓</span><span><strong>Respaldo del Grupo CDCom:</strong> conectamos tu marca con internet, software y energía si lo necesitas.</span></li>
          <li class="flex gap-3"><span class="text-purple-500 font-bold">✓</span><span><strong>Enfoque regional:</strong> entendemos el mercado de La Huerta y zona costa sur de Jalisco.</span></li>
          <li class="flex gap-3"><span class="text-purple-500 font-bold">✓</span><span><strong>Entregables reales:</strong> archivos editables, no solo imágenes exportadas.</span></li>
          <li class="flex gap-3"><span class="text-purple-500 font-bold">✓</span><span><strong>Comunicación ágil:</strong> seguimiento por WhatsApp y reuniones puntuales.</span></li>
        </ul>
      </${D}>
      <${D} class="cdcom-panel rounded-2xl bg-gradient-to-br from-purple-50 to-orange-50 dark:from-purple-500/10 dark:to-orange-500/5 border border-purple-100 dark:border-purple-500/20 p-8">
        <h3 class="font-bold text-lg mb-4">Ecosistema CDCom</h3>
        <p class="text-sm text-gray-500 dark:text-zinc-400 mb-5">Un solo grupo para tu operación y tu imagen:</p>
        <${D} class="space-y-2 text-sm">
          <a href="/internet" class="flex justify-between py-2 border-b border-purple-100 dark:border-white/10 hover:text-purple-600 transition">CDCom Internet <span>→</span></a>
          <a href="/systems" class="flex justify-between py-2 border-b border-purple-100 dark:border-white/10 hover:text-purple-600 transition">CDCom Systems <span>→</span></a>
          <a href="/energy" class="flex justify-between py-2 border-b border-purple-100 dark:border-white/10 hover:text-purple-600 transition">CDCom Energy <span>→</span></a>
          <a href="/" class="flex justify-between py-2 hover:text-purple-600 transition">Grupo CDCom <span>→</span></a>
        </${D}>
      </${D}>
    </${D}>
  </section>

  <!-- PORTAFOLIO -->
  <section id="portafolio" class="py-20 md:py-28 motion-reveal border-t border-gray-100 dark:border-white/5">
    <${D} class="max-w-6xl mx-auto px-5">
      <${D} class="text-center mb-14">
        <p class="cdcom-section-label text-xs font-semibold tracking-widest uppercase text-purple-600 dark:text-purple-400 mb-3">Portafolio</p>
        <h2 class="cdcom-section-title text-3xl md:text-4xl font-bold tracking-tight mb-4">Tipos de entregables</h2>
        <p class="cdcom-section-desc text-gray-500 dark:text-zinc-400 max-w-lg mx-auto">Referencias visuales del estilo y calidad que manejamos en cada disciplina.</p>
      </${D}>
      <${D} class="grid grid-cols-2 md:grid-cols-3 gap-4 motion-stagger">
        ${portfolioItem('1626785774573-4b799315345d', 'Identidad visual', 'Logo, papelería y redes')}
        ${portfolioItem('1611532736597-de2d4265fba3', 'Social media', 'Feed y stories')}
        ${portfolioItem('1574717024653-61fd2cf4d44d', 'Video', 'Corporativo y reels')}
        ${portfolioItem('1558655146-9f40138edfeb', 'Impresos', 'Lonas, tarjetas, menús')}
        ${portfolioItem('1542744094-3a31f272c490', 'Web', 'Landings y sitios')}
        ${portfolioItem('1600132806370-bf17e65e942f', 'Foto', 'Producto y locación')}
      </${D}>
    </${D}>
  </section>

  <!-- FAQ -->
  <section id="faq" class="py-20 md:py-28 motion-reveal border-t border-gray-100 dark:border-white/5">
    <${D} class="max-w-3xl mx-auto px-5">
      <${D} class="text-center mb-12">
        <p class="cdcom-section-label text-xs font-semibold tracking-widest uppercase text-purple-600 dark:text-purple-400 mb-3">Preguntas frecuentes</p>
        <h2 class="cdcom-section-title text-2xl md:text-3xl font-bold tracking-tight">Antes de contratar</h2>
      </${D}>
      <${D} class="space-y-4">
        ${faq('¿Cuánto tarda un proyecto de branding?', 'Un logo con papelería básica suele tomar 2–3 semanas. Un manual completo y aplicaciones puede llevar 4–6 semanas según revisiones.')}
        ${faq('¿Los precios incluyen impresión?', 'Cotizamos diseño y archivos listos para imprenta. La producción física se cotiza aparte o con proveedores locales.')}
        ${faq('¿Puedo contratar solo redes sociales?', 'Sí. Ofrecemos paquetes mensuales de diseño y calendario sin branding previo, aunque recomendamos tener identidad definida.')}
        ${faq('¿Trabajan fuera de La Huerta?', 'Sí, atendemos todo México de forma remota; sesiones presenciales de foto/video se acuerdan en zona sur de Jalisco.')}
      </${D}>
    </${D}>
  </section>

  <!-- CTA -->
  <section id="contacto" class="py-20 md:py-28 motion-reveal border-t border-gray-100 dark:border-white/5">
    <${D} class="max-w-3xl mx-auto px-5 text-center">
      <${D} class="cdcom-cta-box rounded-3xl bg-gradient-to-br from-purple-50 to-orange-50 dark:from-purple-500/5 dark:to-orange-500/5 border border-purple-200 dark:border-purple-500/10 p-12 md:p-16">
        <h2 class="text-2xl md:text-3xl font-bold tracking-tight mb-4">Cuéntanos tu proyecto</h2>
        <p class="text-gray-500 dark:text-zinc-400 mb-8 max-w-md mx-auto">Agenda una llamada o envíanos un mensaje. Te respondemos con propuesta y tiempos en menos de 48 horas hábiles.</p>
        <${D} class="flex flex-col sm:flex-row gap-3 justify-center">
          <a href="https://wa.me/523151259871?text=Hola%2C%20quiero%20cotizar%20un%20proyecto%20creativo" target="_blank" class="inline-flex justify-center px-7 py-3.5 rounded-xl bg-gradient-to-r from-purple-600 to-orange-500 text-white font-bold text-sm hover:opacity-90 transition shadow-lg shadow-purple-600/20">WhatsApp</a>
          <a href="mailto:cdcomcomunicaciones@gmail.com?subject=Cotización%20CDCom%20Creative" class="inline-flex justify-center px-7 py-3.5 rounded-xl border border-gray-300 dark:border-white/10 text-sm font-semibold hover:border-purple-500 transition">cdcomcomunicaciones@gmail.com</a>
        </${D}>
        <p class="text-xs text-gray-400 mt-6">La Huerta, Jalisco · Parte del Grupo CDCom</p>
      </${D}>
    </${D}>
  </section>
`;

function serviceCard(emoji, title, desc, bullets) {
  const lis = bullets.map((b) => `<li class="flex gap-2 text-xs text-gray-500 dark:text-zinc-400"><span class="text-purple-500">•</span>${b}</li>`).join('');
  return `<${D} class="motion-card-shine rounded-2xl bg-gray-50 dark:bg-white/[0.03] border border-gray-100 dark:border-white/5 p-7 hover:border-purple-300 dark:hover:border-purple-500/20 transition-all">
    <${D} class="text-3xl mb-4">${emoji}</${D}>
    <h3 class="font-bold mb-2">${title}</h3>
    <p class="text-sm text-gray-500 dark:text-zinc-400 leading-relaxed mb-4">${desc}</p>
    <ul class="space-y-1">${lis}</ul>
  </${D}>`;
}

function stepCard(num, title, text) {
  return `<${D} class="motion-card-shine rounded-xl bg-gray-50 dark:bg-white/[0.03] border border-gray-100 dark:border-white/5 p-6">
    <${D} class="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-orange-500 mb-3">${num}</${D}>
    <h3 class="font-semibold text-[15px] mb-2">${title}</h3>
    <p class="text-sm text-gray-500 dark:text-zinc-400 leading-relaxed">${text}</p>
  </${D}>`;
}

function sectorCard(emoji, title, text) {
  return `<${D} class="motion-card-shine rounded-xl bg-white dark:bg-white/[0.03] border border-gray-100 dark:border-white/5 p-5">
    <${D} class="text-2xl mb-2">${emoji}</${D}>
    <h3 class="font-semibold text-sm mb-1">${title}</h3>
    <p class="text-xs text-gray-500 dark:text-zinc-400">${text}</p>
  </${D}>`;
}

function packCard(name, subtitle, items, popular) {
  const lis = items.map((i) => `<li class="flex gap-2 text-sm text-gray-600 dark:text-zinc-300"><span class="text-purple-500">✓</span>${i}</li>`).join('');
  const pop = popular
    ? `<${D} class="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-gradient-to-r from-purple-600 to-orange-500 text-white text-[10px] font-bold uppercase">Recomendado</${D}>`
    : '';
  const border = popular ? 'border-2 border-purple-300 dark:border-purple-500/40' : 'border border-gray-100 dark:border-white/5';
  return `<${D} class="motion-card-shine relative rounded-2xl bg-gray-50 dark:bg-white/[0.03] ${border} p-7">
    ${pop}
    <h3 class="font-bold text-lg mb-1">${name}</h3>
    <p class="text-xs text-gray-500 dark:text-zinc-400 mb-5">${subtitle}</p>
    <ul class="space-y-2 mb-6">${lis}</ul>
    <a href="https://wa.me/523151259871?text=Hola%2C%20me%20interesa%20el%20paquete%20${encodeURIComponent(name)}%20de%20CDCom%20Creative" target="_blank" class="block text-center py-2.5 rounded-lg text-sm font-semibold ${popular ? 'bg-gradient-to-r from-purple-600 to-orange-500 text-white' : 'border border-gray-300 dark:border-white/10 hover:border-purple-500'} transition">Solicitar cotización</a>
  </${D}>`;
}

function portfolioItem(id, title, sub) {
  return `<${D} class="group">
    <${D} class="aspect-[4/3] rounded-2xl overflow-hidden border border-gray-100 dark:border-white/5 group-hover:scale-[1.02] transition-transform">
      <img src="https://images.unsplash.com/photo-${id}?w=500&q=80" alt="${title}" class="w-full h-full object-cover" loading="lazy" />
    </${D}>
    <p class="mt-2 text-sm font-semibold">${title}</p>
    <p class="text-xs text-gray-500">${sub}</p>
  </${D}>`;
}

function faq(q, a) {
  return `<${D} class="rounded-xl border border-gray-100 dark:border-white/5 bg-gray-50/80 dark:bg-white/[0.02] p-5">
    <h3 class="font-semibold text-[15px] mb-2">${q}</h3>
    <p class="text-sm text-gray-500 dark:text-zinc-400 leading-relaxed">${a}</p>
  </${D}>`;
}

const start = html.indexOf('  <!-- HERO -->');
const end = html.indexOf('  <!-- FOOTER -->');
if (start < 0 || end < 0) throw new Error('markers missing');

html =
  html.slice(0, start) +
  middle +
  '\n\n' +
  html.slice(end);
html = html.replace(
  '<link rel="stylesheet" href="/landing-assets/cdcom-pro.css" />',
  '  <link rel="stylesheet" href="/landing-assets/cdcom-pro.css" />'
);
html = html.replace(
  '</footer>  <script src="/landing-assets/cdcom-motion.js">',
  '</footer>\n\n  <script src="/landing-assets/cdcom-motion.js">'
);
html = html.replace(
  '<meta name="description" content="CDCom Creative: Branding, identidad digital, producción audiovisual y marketing digital." />',
  '<meta name="description" content="CDCom Creative: branding, redes sociales, video, web y campañas digitales en La Huerta y zona sur de Jalisco. Paquetes desde identidad visual hasta lanzamiento integral." />'
);

fs.writeFileSync(file, html, 'utf8');
console.log('Creative page expanded OK');
