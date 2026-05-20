/**
 * CDCom landings — scroll reveal, contadores, nav, parallax ligero
 */
(function () {
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function initReveal() {
    var selectors = '.motion-reveal, .motion-reveal-left, .motion-reveal-right, .motion-reveal-scale, .fade-in, .motion-stagger';
    var nodes = document.querySelectorAll(selectors);
    if (!nodes.length) return;

    if (reduced) {
      nodes.forEach(function (el) {
        el.classList.add('is-visible', 'visible');
      });
      return;
    }

    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          var el = entry.target;
          el.classList.add('is-visible', 'visible');
          el.querySelectorAll('.motion-stagger > *').forEach(function (child) {
            child.style.opacity = '';
            child.style.transform = '';
          });
          io.unobserve(el);
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
    );

    nodes.forEach(function (el) {
      io.observe(el);
    });
  }

  function initCounters() {
    var els = document.querySelectorAll('[data-count]');
    if (!els.length || reduced) return;

    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          var el = entry.target;
          io.unobserve(el);
          var raw = el.getAttribute('data-count') || '';
          var suffix = el.getAttribute('data-count-suffix') || '';
          var prefix = el.getAttribute('data-count-prefix') || '';
          var decimals = parseInt(el.getAttribute('data-count-decimals') || '0', 10);
          var target = parseFloat(raw.replace(/[^\d.]/g, ''));
          if (isNaN(target)) return;
          var duration = 1400;
          var start = performance.now();
          function tick(now) {
            var t = Math.min(1, (now - start) / duration);
            var eased = 1 - Math.pow(1 - t, 3);
            var val = target * eased;
            el.textContent = prefix + val.toFixed(decimals) + suffix;
            if (t < 1) requestAnimationFrame(tick);
            else el.textContent = prefix + target.toFixed(decimals) + suffix;
          }
          requestAnimationFrame(tick);
        });
      },
      { threshold: 0.4 }
    );
    els.forEach(function (el) {
      io.observe(el);
    });
  }

  function initNavScroll() {
    var nav = document.querySelector('nav');
    if (!nav) return;
    var onScroll = function () {
      if (window.scrollY > 12) nav.classList.add('cdcom-nav-scrolled');
      else nav.classList.remove('cdcom-nav-scrolled');
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  function initParallax() {
    if (reduced) return;
    var layers = document.querySelectorAll('[data-parallax]');
    if (!layers.length) return;
    var ticking = false;
    window.addEventListener(
      'scroll',
      function () {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(function () {
          var y = window.scrollY;
          layers.forEach(function (el) {
            var speed = parseFloat(el.getAttribute('data-parallax')) || 0.15;
            el.style.transform = 'translate3d(0, ' + y * speed + 'px, 0)';
          });
          ticking = false;
        });
      },
      { passive: true }
    );
  }

  function initSmoothAnchors() {
    document.querySelectorAll('a[href^="#"]').forEach(function (a) {
      a.addEventListener('click', function (e) {
        var id = a.getAttribute('href');
        if (!id || id === '#') return;
        var target = document.querySelector(id);
        if (!target) return;
        e.preventDefault();
        target.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
      });
    });
  }

  function boot() {
    initReveal();
    initCounters();
    initNavScroll();
    initParallax();
    initSmoothAnchors();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
