/**
 * Amplía server/public-main/index.html
 * node server/scripts/expand-main-landing.js
 */
const fs = require('fs');
const path = require('path');

const D = 'd' + 'iv';
const file = path.join(__dirname, '..', 'public-main', 'index.html');
let html = fs.readFileSync(file, 'utf8');

const lines = [];
const w = (s) => lines.push(s);

// --- NAV (replace links only) ---
html = html.replace(
  /<div class="hidden md:flex items-center gap-6 text-sm text-gray-500 dark:text-zinc-400">[\s\S]*?<\/div>\s*<div class="flex items-center gap-3">/,
  `<div class="hidden md:flex items-center gap-6 text-sm text-gray-500 dark:text-zinc-400">
        <a href="#empresas" class="hover:text-blue-600 dark:hover:text-blue-400 transition">Empresas</a>
        <a href="#soluciones" class="hover:text-blue-600 dark:hover:text-blue-400 transition">Soluciones</a>
        <a href="#nosotros" class="hover:text-blue-600 dark:hover:text-blue-400 transition">Nosotros</a>
        <a href="#infraestructura" class="hover:text-blue-600 dark:hover:text-blue-400 transition">Infraestructura</a>
        <a href="#contacto" class="hover:text-blue-600 dark:hover:text-blue-400 transition">Contacto</a>
      </div>
      <div class="flex items-center gap-3">`
);

const start = html.indexOf('  <!-- HERO -->');
const end = html.indexOf('  <!-- FOOTER -->');
if (start < 0 || end < 0) throw new Error('markers not found');

w('  <!-- HERO -->');
w('  <section class="relative pt-24 pb-16 md:pt-36 md:pb-24 overflow-hidden">');
w(`    <${D} class="motion-orb w-[420px] h-[420px] top-[-80px] left-[10%] bg-blue-400/30 dark:bg-blue-500/20"></${D}>`);
w(`    <${D} class="motion-orb motion-orb--2 w-[360px] h-[360px] top-[20%] right-[5%] bg-cyan-400/25 dark:bg-cyan-500/15"></${D}>`);
w(`    <${D} class="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[450px] bg-gradient-to-b from-blue-100/60 dark:from-blue-500/5 to-transparent rounded-full blur-3xl pointer-events-none" data-parallax="0.08"></${D}>`);
w(`    <${D} class="max-w-6xl mx-auto px-5 grid md:grid-cols-2 gap-10 items-center relative z-10">`);
w(`      <${D} class="motion-hero">`);
w('        <p class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-blue-200 dark:border-blue-500/25 bg-blue-50 dark:bg-blue-500/10 text-xs font-semibold text-blue-700 dark:text-blue-300 mb-5 cdcom-hero-badge">');
w('          <span class="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>');
w('          Grupo CDCom · La Huerta, Jalisco');
w('        </p>');
w('        <h1 class="text-4xl md:text-5xl font-black tracking-tight leading-[1.08] mb-5">');
w('          <span class="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-cyan-500 dark:from-blue-400 dark:to-cyan-400 motion-gradient-text">Infraestructura Digital</span><br/>');
w('          de Próxima Generación');
w('        </h1>');
w('        <p class="text-lg text-gray-500 dark:text-zinc-400 max-w-xl mb-8 leading-relaxed">');
w('          Cuatro divisiones especializadas bajo un mismo estándar: conectividad, software, marca y energía. Soluciones para hogares, negocios e infraestructura crítica en el sur de Jalisco.');
w('        </p>');
w(`        <${D} class="flex flex-wrap gap-3 mb-10">`);
w('          <a href="https://wa.me/523151259871" target="_blank" rel="noopener" class="px-7 py-3.5 rounded-xl bg-blue-600 text-white font-bold text-sm hover:bg-blue-700 transition shadow-lg shadow-blue-600/20">Cotizar servicio</a>');
w('          <a href="#empresas" class="px-7 py-3.5 rounded-xl border border-gray-300 dark:border-white/10 text-sm font-medium hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400 transition">Explorar ecosistema</a>');
w(`        </${D}>`);
w(`        <${D} class="grid grid-cols-2 sm:grid-cols-4 gap-3">`);
w(`          <${D} class="cdcom-stat rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/5 p-4 text-center"><${D} class="text-xl font-bold text-blue-600 dark:text-blue-400">4</${D}><${D} class="text-[11px] text-gray-500 dark:text-zinc-500 mt-0.5">Divisiones</${D}></${D}>`);
w(`          <${D} class="cdcom-stat rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/5 p-4 text-center"><${D} class="text-xl font-bold text-cyan-600 dark:text-cyan-400">500+</${D}><${D} class="text-[11px] text-gray-500 dark:text-zinc-500 mt-0.5">Clientes activos</${D}></${D}>`);
w(`          <${D} class="cdcom-stat rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/5 p-4 text-center"><${D} class="text-xl font-bold text-emerald-600 dark:text-emerald-400">24/7</${D}><${D} class="text-[11px] text-gray-500 dark:text-zinc-500 mt-0.5">Soporte</${D}></${D}>`);
w(`          <${D} class="cdcom-stat rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/5 p-4 text-center"><${D} class="text-xl font-bold text-amber-600 dark:text-amber-400">99.9%</${D}><${D} class="text-[11px] text-gray-500 dark:text-zinc-500 mt-0.5">SLA red</${D}></${D}>`);
w(`        </${D}>`);
w(`      </${D}>`);
w(`      <${D} class="relative hidden md:block motion-reveal-right cdcom-hero-visual">`);
w('        <img src="https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=600&q=80" alt="Infraestructura digital" class="motion-float rounded-2xl shadow-2xl shadow-blue-500/10 w-full object-cover h-[360px]" />');
w(`        <${D} class="absolute -bottom-4 -left-4 w-24 h-24 rounded-xl overflow-hidden shadow-lg border-4 border-white dark:border-[#0a0e1a]">`);
w('          <img src="https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=200&q=80" alt="Dashboard" class="w-full h-full object-cover" />');
w(`        </${D}>`);
w(`      </${D}>`);
w(`    </${D}>`);
w('  </section>');

function divisionCard(href, img, alt, title, colorClass, accentHover, desc, bullets) {
  const lis = bullets.map((b) => `<li class="text-[11px] text-gray-500 dark:text-zinc-400 flex gap-1.5"><span class="${colorClass}">•</span>${b}</li>`).join('');
  w(`        <a href="${href}" class="motion-card-shine group flex flex-col rounded-2xl bg-gray-50 dark:bg-white/[0.03] border border-gray-100 dark:border-white/5 overflow-hidden ${accentHover} hover:-translate-y-1 transition-all duration-300 h-full">`);
  w(`          <img src="${img}" alt="${alt}" class="w-full h-32 object-cover" loading="lazy" />`);
  w(`          <${D} class="p-5 flex flex-col flex-1">`);
  w(`            <h3 class="font-bold mb-1">${title}</h3>`);
  w(`            <p class="text-xs text-gray-500 dark:text-zinc-500 mb-3 leading-relaxed">${desc}</p>`);
  w(`            <ul class="space-y-1 mb-3 flex-1">${lis}</ul>`);
  w(`            <span class="text-xs font-semibold ${colorClass} group-hover:underline mt-auto">Explorar división →</span>`);
  w(`          </${D}>`);
  w('        </a>');
}

w('');
w('  <!-- DIVISIONES -->');
w('  <section id="empresas" class="py-16 md:py-24 border-t border-gray-100 dark:border-white/5">');
w(`    <${D} class="max-w-6xl mx-auto px-5">`);
w(`      <${D} class="text-center mb-12 motion-reveal">`);
w('        <p class="cdcom-section-label text-xs font-semibold tracking-widest uppercase text-blue-600 dark:text-blue-400 mb-2">Nuestras empresas</p>');
w('        <h2 class="cdcom-section-title text-3xl md:text-4xl font-bold tracking-tight mb-3">Ecosistema CDCom</h2>');
w('        <p class="cdcom-section-desc text-gray-500 dark:text-zinc-400 max-w-2xl mx-auto">Cada división atiende una necesidad con equipos y procesos propios. Puedes contratar una sola línea o combinar varias con un solo interlocutor.</p>');
w(`      </${D}>`);
w(`      <${D} class="grid md:grid-cols-2 lg:grid-cols-4 gap-5 motion-stagger">`);
divisionCard('/internet', 'https://images.unsplash.com/photo-1544197150-b99a580bb7a8?w=400&q=80', 'Internet WISP', 'CDCom <span class="text-blue-600 dark:text-blue-400">Internet</span>', 'text-blue-600 dark:text-blue-400', 'hover:border-blue-400 dark:hover:border-blue-500/30', 'Internet por radio en La Huerta y zona sur de Jalisco. Instalación, soporte local y portal del cliente.', ['Planes residenciales y negocio', 'Monitoreo de red 24/7', 'Área de clientes en línea']);
divisionCard('/systems', 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=400&q=80', 'Software', 'CDCom <span class="text-cyan-600 dark:text-cyan-400">Systems</span>', 'text-cyan-600 dark:text-cyan-400', 'hover:border-cyan-400 dark:hover:border-cyan-500/30', 'Software a medida, sistemas administrativos y automatización para operar sin procesos manuales.', ['ERP / panel de gestión', 'Portales de clientes', 'Integraciones y APIs']);
divisionCard('/creative', 'https://images.unsplash.com/photo-1561070791-2526d30994b5?w=400&q=80', 'Creative', 'CDCom <span class="text-purple-600 dark:text-purple-400">Creative</span>', 'text-purple-600 dark:text-purple-400', 'hover:border-purple-400 dark:hover:border-purple-500/30', 'Branding, redes, video y campañas para que tu negocio se vea profesional y venda más.', ['Identidad visual', 'Social media y ads', 'Web y producción']);
divisionCard('/energy', 'https://images.unsplash.com/photo-1509391366360-2e959784a276?w=400&q=80', 'Energy', 'CDCom <span class="text-amber-600 dark:text-amber-400">Energy</span>', 'text-amber-600 dark:text-amber-400', 'hover:border-amber-400 dark:hover:border-amber-500/30', 'Respaldo energético para hogares, negocios y torres. UPS, solar y continuidad operativa.', ['UPS y respaldo', 'Paneles solares', 'Monitoreo energético']);
w(`      </${D}>`);
w(`    </${D}>`);
w('  </section>');

w('');
w('  <!-- SOLUCIONES INTEGRADAS -->');
w('  <section id="soluciones" class="py-20 md:py-28 motion-reveal border-t border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-white/[0.02]">');
w(`    <${D} class="max-w-6xl mx-auto px-5">`);
w(`      <${D} class="mb-14">`);
w('        <p class="cdcom-section-label text-xs font-semibold tracking-widest uppercase text-blue-600 dark:text-blue-400 mb-3">Soluciones integradas</p>');
w('        <h2 class="cdcom-section-title text-2xl md:text-3xl font-bold tracking-tight mb-3">Un proveedor, varias capas de valor</h2>');
w('        <p class="cdcom-section-desc text-gray-500 dark:text-zinc-400 max-w-2xl text-[15px]">Combinamos conectividad, sistemas, marca y energía para proyectos que necesitan más que un solo servicio aislado.</p>');
w(`      </${D}>`);
w(`      <${D} class="grid md:grid-cols-2 lg:grid-cols-3 gap-5 motion-stagger">`);
const sol = [
  ['📡', 'Proveedor de internet (WISP)', 'Red propia, instalaciones, cobranza, tickets y portal del cliente integrado.', 'Internet + Systems'],
  ['🏪', 'Negocio en crecimiento', 'Internet en el local, página web, redes sociales y respaldo eléctrico para tu operación.', 'Internet + Creative + Energy'],
  ['🏢', 'Empresa con operación digital', 'Sistema administrativo, marca corporativa y campañas para captar clientes.', 'Systems + Creative'],
  ['🗼', 'Infraestructura crítica', 'Torres con energía de respaldo, monitoreo y conectividad redundante.', 'Energy + Internet + Systems'],
  ['🎓', 'Instituciones y oficinas', 'Red estable, videovigilancia, web institucional y soporte técnico local.', 'Internet + Creative'],
  ['🔧', 'Integración a medida', 'APIs, automatizaciones y desarrollos especiales según tu flujo de trabajo.', 'Systems'],
];
sol.forEach(([icon, title, desc, tags]) => {
  w(`        <${D} class="motion-card-shine rounded-xl bg-white dark:bg-white/[0.03] border border-gray-100 dark:border-white/5 p-6">`);
  w(`          <${D} class="text-2xl mb-3">${icon}</${D}>`);
  w(`          <h3 class="font-semibold text-[15px] mb-2">${title}</h3>`);
  w(`          <p class="text-sm text-gray-500 dark:text-zinc-400 leading-relaxed mb-3">${desc}</p>`);
  w(`          <p class="text-[11px] font-medium text-blue-600 dark:text-blue-400">${tags}</p>`);
  w(`        </${D}>`);
});
w(`      </${D}>`);
w(`    </${D}>`);
w('  </section>');

w('');
w('  <!-- NOSOTROS -->');
w('  <section id="nosotros" class="py-20 md:py-28 motion-reveal border-t border-gray-100 dark:border-white/5">');
w(`    <${D} class="max-w-6xl mx-auto px-5 grid md:grid-cols-2 gap-10 items-start">`);
w(`      <${D}>`);
w('        <p class="cdcom-section-label text-xs font-semibold tracking-widest uppercase text-blue-600 dark:text-blue-400 mb-3">Quiénes somos</p>');
w('        <h2 class="cdcom-section-title text-2xl md:text-3xl font-bold tracking-tight mb-4">Tecnología con raíz local</h2>');
w('        <p class="text-[15px] text-gray-600 dark:text-zinc-300 leading-relaxed mb-4">Grupo CDCom nació en La Huerta, Jalisco, para llevar conectividad y servicios digitales a comunidades que antes tenían pocas opciones. Hoy somos un ecosistema de cuatro marcas que comparten la misma exigencia de calidad y soporte cercano.</p>');
w('        <p class="text-[15px] text-gray-600 dark:text-zinc-300 leading-relaxed mb-6">No somos un revendedor genérico: diseñamos, instalamos, desarrollamos y damos seguimiento con equipos propios. Eso nos permite responder rápido y adaptar cada proyecto a la realidad de la región.</p>');
w('        <ul class="space-y-3 text-sm text-gray-600 dark:text-zinc-300">');
w('          <li class="flex gap-2"><span class="text-blue-500 font-bold">✓</span> Atención directa por WhatsApp y visitas cuando se requiere</li>');
w('          <li class="flex gap-2"><span class="text-blue-500 font-bold">✓</span> Proyectos para hogares, comercios e infraestructura WISP</li>');
w('          <li class="flex gap-2"><span class="text-blue-500 font-bold">✓</span> Desarrollo de software usado en producción por nuestros propios clientes</li>');
w('        </ul>');
w(`      </${D}>`);
w(`      <${D} class="cdcom-panel rounded-2xl bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-500/10 dark:to-cyan-500/5 border border-blue-100 dark:border-blue-500/20 p-8">`);
w('        <h3 class="font-bold text-lg mb-4">Misión</h3>');
w('        <p class="text-sm text-gray-600 dark:text-zinc-300 leading-relaxed mb-6">Conectar personas y negocios con infraestructura confiable, herramientas digitales útiles y una imagen profesional, para que la tecnología impulse —y no frene— su día a día.</p>');
w('        <h3 class="font-bold text-lg mb-4">Visión</h3>');
w('        <p class="text-sm text-gray-600 dark:text-zinc-300 leading-relaxed">Ser el grupo tecnológico de referencia en el sur de Jalisco, reconocido por la calidad de servicio, la innovación práctica y la confianza de nuestra comunidad.</p>');
w(`      </${D}>`);
w(`    </${D}>`);
w('  </section>');

w('');
w('  <!-- PROCESO -->');
w('  <section id="proceso" class="py-20 md:py-28 motion-reveal border-t border-gray-100 dark:border-white/5">');
w(`    <${D} class="max-w-6xl mx-auto px-5">`);
w(`      <${D} class="text-center mb-14">`);
w('        <p class="cdcom-section-label text-xs font-semibold tracking-widest uppercase text-blue-600 dark:text-blue-400 mb-3">Cómo empezar</p>');
w('        <h2 class="cdcom-section-title text-2xl md:text-3xl font-bold tracking-tight mb-3">De la idea al servicio en marcha</h2>');
w('        <p class="cdcom-section-desc text-gray-500 dark:text-zinc-400 max-w-xl mx-auto">Un flujo simple, sin burocracia innecesaria, con un asesor que te guía según la división que necesites.</p>');
w(`      </${D}>`);
w(`      <${D} class="grid md:grid-cols-4 gap-4 motion-stagger">`);
[['01', 'Contacto', 'Nos escribes por WhatsApp o formulario. Cuéntanos qué necesitas y en qué zona estás.'], ['02', 'Diagnóstico', 'Revisamos cobertura, alcance técnico o creativo y te proponemos opciones claras.'], ['03', 'Propuesta', 'Recibes cotización con tiempos, entregables y siguientes pasos — sin letra chica.'], ['04', 'Implementación', 'Instalamos, desarrollamos o producimos, y te acompañamos en la puesta en marcha.']].forEach(([n, t, p]) => {
  w(`        <${D} class="motion-card-shine rounded-xl bg-gray-50 dark:bg-white/[0.03] border border-gray-100 dark:border-white/5 p-6">`);
  w(`          <${D} class="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-cyan-500 mb-3">${n}</${D}>`);
  w(`          <h3 class="font-semibold text-[15px] mb-2">${t}</h3>`);
  w(`          <p class="text-sm text-gray-500 dark:text-zinc-400 leading-relaxed">${p}</p>`);
  w(`        </${D}>`);
});
w(`      </${D}>`);
w(`    </${D}>`);
w('  </section>');

w('');
w('  <!-- INFRAESTRUCTURA + HERRAMIENTAS -->');
w('  <section id="infraestructura" class="py-16 md:py-24 border-t border-gray-100 dark:border-white/5">');
w(`    <${D} class="max-w-6xl mx-auto px-5">`);
w(`      <${D} class="text-center mb-12 motion-reveal">`);
w('        <p class="cdcom-section-label text-xs font-semibold tracking-widest uppercase text-blue-600 dark:text-blue-400 mb-2">Plataforma y confianza</p>');
w('        <h2 class="cdcom-section-title text-3xl md:text-4xl font-bold tracking-tight mb-3">Infraestructura que respalda el servicio</h2>');
w('        <p class="cdcom-section-desc text-gray-500 dark:text-zinc-400 max-w-2xl mx-auto">Red, sistemas en la nube, portal del cliente y herramientas digitales incluidas para quienes ya son parte de CDCom.</p>');
w(`      </${D}>`);
w(`    <${D} class="grid md:grid-cols-2 gap-6">`);
w(`      <${D} class="cdcom-panel rounded-2xl bg-gray-50 dark:bg-white/[0.03] border border-gray-100 dark:border-white/5 p-7">`);
w('        <h3 class="font-bold text-lg mb-2">Portal del cliente</h3>');
w('        <p class="text-sm text-gray-500 dark:text-zinc-400 mb-5 leading-relaxed">Clientes de Internet y servicios vinculados consultan saldo, pagan, abren tickets y descargan comprobantes desde cualquier dispositivo.</p>');
w('        <a href="/portal/login" class="inline-flex text-sm font-semibold text-blue-600 dark:text-blue-400 hover:underline mb-5">Acceder al portal →</a>');
w('        <h3 class="font-bold text-lg mb-5">Herramientas digitales</h3>');
w(`        <${D} class="grid grid-cols-3 gap-3 motion-stagger">`);
w(`          <${D} class="rounded-xl bg-white dark:bg-white/[0.03] border border-gray-100 dark:border-white/5 p-4 text-center">`);
w(`            <${D} class="w-10 h-10 mx-auto rounded-lg bg-green-100 dark:bg-green-500/10 flex items-center justify-center text-lg mb-2">💬</${D}>`);
w(`            <${D} class="text-xs font-semibold">WhatsApp</${D}><${D} class="text-[10px] text-gray-400">Enlaces y mensajes</${D}>`);
w(`          </${D}>`);
w(`          <${D} class="rounded-xl bg-white dark:bg-white/[0.03] border border-gray-100 dark:border-white/5 p-4 text-center">`);
w(`            <${D} class="w-10 h-10 mx-auto rounded-lg bg-blue-100 dark:bg-blue-500/10 flex items-center justify-center text-lg mb-2">📱</${D}>`);
w(`            <${D} class="text-xs font-semibold">QR Gen</${D}><${D} class="text-[10px] text-gray-400">Códigos al instante</${D}>`);
w(`          </${D}>`);
w(`          <${D} class="rounded-xl bg-white dark:bg-white/[0.03] border border-gray-100 dark:border-white/5 p-4 text-center">`);
w(`            <${D} class="w-10 h-10 mx-auto rounded-lg bg-purple-100 dark:bg-purple-500/10 flex items-center justify-center text-lg mb-2">✍️</${D}>`);
w(`            <${D} class="text-xs font-semibold">Text Refiner</${D}><${D} class="text-[10px] text-gray-400">Mejora de textos</${D}>`);
w(`          </${D}>`);
w(`        </${D}>`);
w(`        <${D} class="mt-4 text-xs text-gray-500 dark:text-zinc-500 bg-white dark:bg-white/[0.02] border border-gray-100 dark:border-white/5 rounded-lg p-3 text-center">`);
w('          <strong class="text-cyan-600 dark:text-cyan-400">Beneficio exclusivo:</strong> acceso al portal de herramientas para clientes activos de CDCom Internet.');
w(`        </${D}>`);
w(`      </${D}>`);
w(`      <${D} class="cdcom-panel rounded-2xl bg-gray-50 dark:bg-white/[0.03] border border-gray-100 dark:border-white/5 p-7">`);
w('        <h3 class="font-bold text-lg mb-5">Cobertura y confianza</h3>');
w(`        <${D} class="grid grid-cols-2 gap-3">`);
w(`          <${D} class="col-span-2 rounded-xl bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-500/5 dark:to-cyan-500/5 border border-blue-100 dark:border-blue-500/10 p-5 text-center">`);
w(`            <${D} class="text-2xl mb-1">📍</${D}>`);
w(`            <${D} class="text-[10px] uppercase tracking-widest text-gray-400 mb-1">Operación principal</${D}>`);
w(`            <${D} class="font-bold">La Huerta, Jalisco</${D}>`);
w(`            <${D} class="text-xs text-gray-500 dark:text-zinc-400">Red WISP · Zona sur y costa · Expansión bajo demanda</${D}>`);
w(`          </${D}>`);
w(`          <${D} class="cdcom-stat rounded-xl bg-white dark:bg-white/[0.03] border border-gray-100 dark:border-white/5 p-4 text-center"><${D} class="text-xl font-black text-blue-600 dark:text-blue-400">500+</${D}><${D} class="text-[10px] text-gray-400">Hogares y negocios</${D}></${D}>`);
w(`          <${D} class="cdcom-stat rounded-xl bg-white dark:bg-white/[0.03] border border-gray-100 dark:border-white/5 p-4 text-center"><${D} class="text-xl font-black text-cyan-600 dark:text-cyan-400">24/7</${D}><${D} class="text-[10px] text-gray-400">Monitoreo de red</${D}></${D}>`);
w(`          <${D} class="cdcom-stat rounded-xl bg-white dark:bg-white/[0.03] border border-gray-100 dark:border-white/5 p-4 text-center"><${D} class="text-xl font-black text-emerald-600 dark:text-emerald-400">Local</${D}><${D} class="text-[10px] text-gray-400">Soporte en español</${D}></${D}>`);
w(`          <${D} class="cdcom-stat rounded-xl bg-white dark:bg-white/[0.03] border border-gray-100 dark:border-white/5 p-4 text-center"><${D} class="text-xl font-black text-amber-600 dark:text-amber-400">99.9%</${D}><${D} class="text-[10px] text-gray-400">Objetivo SLA red</${D}></${D}>`);
w(`        </${D}>`);
w(`        <p class="text-xs text-gray-500 dark:text-zinc-400 mt-4 leading-relaxed">Instalaciones con técnicos propios, inventario de equipos y seguimiento post-venta. Consulta cobertura antes de contratar en <a href="/internet" class="text-blue-600 dark:text-blue-400 hover:underline">CDCom Internet</a>.</p>`);
w(`      </${D}>`);
w(`    </${D}>`);
w(`    </${D}>`);
w('  </section>');

w('');
w('  <!-- FAQ -->');
w('  <section id="faq" class="py-20 md:py-28 motion-reveal border-t border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-white/[0.02]">');
w(`    <${D} class="max-w-3xl mx-auto px-5">`);
w(`      <${D} class="text-center mb-12">`);
w('        <p class="cdcom-section-label text-xs font-semibold tracking-widest uppercase text-blue-600 dark:text-blue-400 mb-3">Preguntas frecuentes</p>');
w('        <h2 class="cdcom-section-title text-2xl md:text-3xl font-bold tracking-tight">Antes de contratar</h2>');
w(`      </${D}>`);
w(`      <${D} class="space-y-4">`);
[
  ['¿Puedo contratar solo una división del grupo?', 'Sí. Cada marca tiene su sitio y equipo: Internet, Systems, Creative o Energy. Si más adelante necesitas otro servicio, lo integramos bajo el mismo grupo.'],
  ['¿Atienden fuera de La Huerta?', 'Internet WISP depende de cobertura en la zona sur de Jalisco. Systems, Creative y Energy atienden proyectos remotos en todo México.'],
  ['¿Cómo sé si hay señal en mi domicilio?', 'Escríbenos por WhatsApp con tu ubicación o visita la página de <a href="/internet" class="text-blue-600 dark:text-blue-400 hover:underline">CDCom Internet</a> para revisar planes y cobertura.'],
  ['¿Ofrecen facturación y soporte formal?', 'Sí. Emitimos comprobantes, llevamos registro de pagos en sistema y damos soporte por tickets, WhatsApp y portal del cliente según el servicio contratado.'],
].forEach(([q, a]) => {
  w(`        <${D} class="rounded-xl border border-gray-100 dark:border-white/5 bg-white dark:bg-white/[0.02] p-5">`);
  w(`          <h3 class="font-semibold text-[15px] mb-2">${q}</h3>`);
  w(`          <p class="text-sm text-gray-500 dark:text-zinc-400 leading-relaxed">${a}</p>`);
  w(`        </${D}>`);
});
w(`      </${D}>`);
w(`    </${D}>`);
w('  </section>');

w('');
w('  <!-- CONTACTO -->');
w('  <section id="contacto" class="py-20 md:py-28 border-t border-gray-100 dark:border-white/5">');
w(`    <${D} class="max-w-3xl mx-auto px-5 text-center">`);
w(`      <${D} class="cdcom-cta-box rounded-3xl bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-500/10 dark:to-cyan-500/5 border border-blue-200 dark:border-blue-500/20 p-12 md:p-16 motion-reveal">`);
w('        <h2 class="text-2xl md:text-3xl font-bold tracking-tight mb-4">¿Listo para impulsar tu proyecto?</h2>');
w('        <p class="text-gray-500 dark:text-zinc-400 mb-8 max-w-md mx-auto leading-relaxed">Cuéntanos qué necesitas — internet, software, marca o energía — y te orientamos con la división correcta del Grupo CDCom.</p>');
w(`        <${D} class="flex flex-col sm:flex-row gap-3 justify-center">`);
w('          <a href="https://wa.me/523151259871" target="_blank" rel="noopener" class="px-7 py-3.5 rounded-xl bg-blue-600 text-white font-bold text-sm hover:bg-blue-700 transition shadow-lg shadow-blue-600/20">WhatsApp</a>');
w('          <a href="mailto:cdcomcomunicaciones@gmail.com?subject=Consulta%20Grupo%20CDCom" class="px-7 py-3.5 rounded-xl border border-gray-300 dark:border-white/10 text-sm font-semibold hover:border-blue-500 transition">cdcomcomunicaciones@gmail.com</a>');
w(`        </${D}>`);
w('        <p class="text-xs text-gray-400 mt-6">La Huerta, Jalisco · Respuesta habitual en menos de 24 h hábiles</p>');
w(`      </${D}>`);
w(`    </${D}>`);
w('  </section>');
w('');

html = html.slice(0, start) + lines.join('\n') + '\n\n' + html.slice(end);

html = html.replace(
  '<meta name="description" content="Grupo CDCom: Líderes en conectividad WISP, ingeniería de software y branding estratégico en La Huerta, Jalisco." />',
  '<meta name="description" content="Grupo CDCom: internet WISP, software, branding y energía en La Huerta y sur de Jalisco. Cuatro divisiones, un solo estándar de servicio." />'
);

fs.writeFileSync(file, html, 'utf8');
console.log('Main landing expanded OK');
