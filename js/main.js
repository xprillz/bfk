/* ==========================================================================
   Bonumfinanz AG — site behaviour (vanilla JS, no dependencies)
   - sticky header + mobile navigation with scroll lock
   - smooth anchor scrolling, fade-up reveal
   - FAQ accordion
   - cookie consent (localStorage: bonum-cookie-consent)
   - award modal (sessionStorage: bonum-award-seen)
   - contact forms -> mailto:info@bonum-finanz.com (honeypot protected)
   - illustrative Festgeld calculator
   ========================================================================== */
(function () {
  'use strict';

  var CONFIG = {
    email: 'info@bonum-finanz.com',
    domain: 'bonum-finanz.com',
    consentKey: 'bonum-cookie-consent',
    awardKey: 'bonum-award-seen',
    consentVersion: 1,
    cookiePolicy: 'cookie-richtlinie.html',
    awardDelay: 1400,
    bannerDelay: 700
  };

  var root = document.documentElement;
  root.classList.add('js');

  /* ----- helpers --------------------------------------------------------- */
  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }
  function on(el, ev, fn, opts) { if (el) el.addEventListener(ev, fn, opts || false); }
  function reducedMotion() {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }
  function store(kind) {
    try {
      var s = window[kind];
      var k = '__bonum_test__';
      s.setItem(k, '1');
      s.removeItem(k);
      return s;
    } catch (e) {
      return null;
    }
  }
  var local = store('localStorage');
  var session = store('sessionStorage');
  var memory = {};

  function readJSON(storage, key) {
    try {
      var raw = storage ? storage.getItem(key) : memory[key];
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }
  function writeValue(storage, key, value) {
    try {
      if (storage) storage.setItem(key, value); else memory[key] = value;
    } catch (e) { memory[key] = value; }
  }
  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }
  function uid(prefix) { return prefix + '-' + Math.random().toString(36).slice(2, 8); }
  function cleanText(s) { return String(s || '').replace(/\s+/g, ' ').replace(/[*:]+\s*$/, '').trim(); }

  /* ----- scroll lock ----------------------------------------------------- */
  var locks = {};
  function lockCount() { return Object.keys(locks).length; }
  function lockScroll(key) {
    if (lockCount() === 0) {
      var sw = window.innerWidth - root.clientWidth;
      root.classList.add('is-locked');
      if (sw > 0) document.body.style.paddingRight = sw + 'px';
    }
    locks[key] = true;
  }
  function unlockScroll(key) {
    delete locks[key];
    if (lockCount() === 0) {
      root.classList.remove('is-locked');
      document.body.style.paddingRight = '';
    }
  }

  /* ----- focus trap ------------------------------------------------------ */
  var FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
  function trapFocus(container, e) {
    if (e.key !== 'Tab') return;
    var items = $$(FOCUSABLE, container).filter(function (el) { return el.offsetParent !== null || el === document.activeElement; });
    if (!items.length) { e.preventDefault(); return; }
    var first = items[0];
    var last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  /* ======================================================================
     1. Sticky header + mobile navigation
     ====================================================================== */
  function initHeader() {
    var header = $('.site-header');
    if (!header) return;

    var ticking = false;
    function update() {
      ticking = false;
      header.classList.toggle('is-scrolled', (window.pageYOffset || root.scrollTop) > 24);
    }
    on(window, 'scroll', function () {
      if (!ticking) { ticking = true; window.requestAnimationFrame(update); }
    }, { passive: true });
    update();

    var toggle = $('.nav-toggle', header);
    if (!toggle) return;

    var menu = null;
    var controls = toggle.getAttribute('aria-controls');
    if (controls) menu = document.getElementById(controls);
    if (!menu) {
      menu = $('#primary-nav, #nav-links, #nav-menu, .nav__menu, .nav-links', header) ||
        (toggle.parentElement && $('.nav > ul, .nav > nav, nav', toggle.parentElement)) ||
        $('nav ul, nav', header);
      if (menu && menu === toggle) menu = null;
    }
    if (menu && !menu.id) menu.id = 'primary-nav';
    if (menu && !controls) toggle.setAttribute('aria-controls', menu.id);
    if (!toggle.hasAttribute('aria-label') && !toggle.textContent.trim()) toggle.setAttribute('aria-label', 'Menü öffnen');
    toggle.setAttribute('aria-expanded', 'false');

    var desktop = window.matchMedia ? window.matchMedia('(min-width: 960px)') : null;

    function setOpen(open) {
      header.classList.toggle('is-open', open);
      if (menu) menu.classList.toggle('is-open', open);
      toggle.classList.toggle('is-active', open);
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (!toggle.textContent.trim()) toggle.setAttribute('aria-label', open ? 'Menü schliessen' : 'Menü öffnen');
      root.classList.toggle('nav-open', open);
      if (open) lockScroll('nav'); else unlockScroll('nav');
    }
    function isOpen() { return header.classList.contains('is-open'); }

    on(toggle, 'click', function () { setOpen(!isOpen()); });
    on(document, 'keydown', function (e) {
      if (e.key === 'Escape' && isOpen()) { setOpen(false); toggle.focus(); }
    });
    on(header, 'click', function (e) {
      var a = e.target.closest ? e.target.closest('a[href]') : null;
      if (a && isOpen()) setOpen(false);
    });
    if (desktop) {
      var onChange = function (e) { if (e.matches && isOpen()) setOpen(false); };
      if (desktop.addEventListener) desktop.addEventListener('change', onChange);
      else if (desktop.addListener) desktop.addListener(onChange);
    }

    // mark current page in navigation
    var path = location.pathname.split('/').pop() || 'index.html';
    $$('.nav a[href]', header).forEach(function (a) {
      if (a.classList.contains('btn') || a.classList.contains('logo')) return;
      var href = a.getAttribute('href');
      if (!href || href.charAt(0) === '#' || /^(https?:|mailto:|tel:)/i.test(href)) return;
      var file = href.split('#')[0].split('?')[0].split('/').pop() || 'index.html';
      if (file === path && href.indexOf('#') === -1 && !a.hasAttribute('aria-current')) a.setAttribute('aria-current', 'page');
    });
  }

  /* ======================================================================
     2. Smooth anchor scrolling
     ====================================================================== */
  function initAnchors() {
    on(document, 'click', function (e) {
      if (e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      var a = e.target.closest ? e.target.closest('a[href^="#"]') : null;
      if (!a) return;
      var hash = a.getAttribute('href');
      if (!hash || hash === '#') {
        if (hash === '#') {
          e.preventDefault();
          window.scrollTo({ top: 0, behavior: reducedMotion() ? 'auto' : 'smooth' });
        }
        return;
      }
      var id;
      try { id = decodeURIComponent(hash.slice(1)); } catch (err) { id = hash.slice(1); }
      var target = document.getElementById(id);
      if (!target) return;
      e.preventDefault();
      target.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' });
      if (history.pushState) {
        try { history.pushState(null, '', hash); } catch (err) { /* file:// fallback */ }
      }
      if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
      try { target.focus({ preventScroll: true }); } catch (err) { target.focus(); }
    });
  }

  /* ======================================================================
     3. Reveal (fade-up)
     ====================================================================== */
  function initReveal() {
    var auto = [
      '.section__head', '.section__header', '.about-intro > *', '.principles > *', '.card',
      '.rates-layout > *', '.network-grid', '.pillars > *', '.awards-grid > *', '.leadership > *',
      '.process-steps > *', '.cta-band__inner > *', '.impressum-card', '.legal-block',
      '.faq-item', '.calculator', '.form-card', '.contact-card', '.page-hero .container > *'
    ].join(',');

    $$(auto).forEach(function (el) {
      if (el.closest('.hero') || el.classList.contains('reveal')) return;
      el.classList.add('reveal');
    });
    $$('[data-reveal], .fade-up').forEach(function (el) {
      if (!el.classList.contains('reveal')) el.classList.add('reveal');
    });

    var items = $$('.reveal');
    if (!items.length) return;

    // stagger siblings
    var counts = typeof Map !== 'undefined' ? new Map() : null;
    items.forEach(function (el) {
      var parent = el.parentElement;
      var n = 0;
      if (counts) { n = counts.get(parent) || 0; counts.set(parent, n + 1); }
      el.style.setProperty('--reveal-delay', Math.min(n, 5) * 90 + 'ms');
    });

    function show(el) {
      el.classList.add('is-visible');
      window.setTimeout(function () {
        el.classList.remove('reveal', 'is-visible');
        el.style.removeProperty('--reveal-delay');
      }, 1900);
    }

    if (!('IntersectionObserver' in window) || reducedMotion()) {
      items.forEach(function (el) { el.classList.remove('reveal'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) { show(entry.target); io.unobserve(entry.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    items.forEach(function (el) { io.observe(el); });

    // safety net: never leave content hidden
    window.setTimeout(function () {
      $$('.reveal:not(.is-visible)').forEach(function (el) {
        var r = el.getBoundingClientRect();
        if (r.top < window.innerHeight && r.bottom > 0) { show(el); io.unobserve(el); }
      });
    }, 2500);
  }

  /* ======================================================================
     4. FAQ accordion
     ====================================================================== */
  function initFaq() {
    var items = $$('.faq-item');
    if (!items.length) return;

    // native <details> items: single-open behaviour
    items.filter(function (i) { return i.tagName === 'DETAILS'; }).forEach(function (d) {
      on(d, 'toggle', function () {
        if (!d.open) return;
        items.forEach(function (o) { if (o !== d && o.tagName === 'DETAILS' && o.parentElement === d.parentElement) o.open = false; });
      });
    });

    items.filter(function (i) { return i.tagName !== 'DETAILS'; }).forEach(function (item) {
      var trigger = $('.faq-item__question, .faq-question, .faq-trigger, button', item);
      if (!trigger) return;
      var panel = $('.faq-item__answer, .faq-answer, .faq-panel', item) ||
        (trigger.closest('h2, h3, h4') ? trigger.closest('h2, h3, h4').nextElementSibling : trigger.nextElementSibling);
      if (!panel) return;

      if (!panel.id) panel.id = uid('faq-panel');
      if (!trigger.id) trigger.id = uid('faq-q');
      trigger.setAttribute('aria-controls', panel.id);
      if (!trigger.getAttribute('type') && trigger.tagName === 'BUTTON') trigger.setAttribute('type', 'button');
      panel.setAttribute('role', 'region');
      panel.setAttribute('aria-labelledby', trigger.id);
      panel.removeAttribute('hidden');

      function set(open) {
        item.classList.toggle('is-open', open);
        trigger.setAttribute('aria-expanded', open ? 'true' : 'false');
        panel.style.maxHeight = open ? panel.scrollHeight + 'px' : '0px';
      }
      set(item.classList.contains('is-open') || trigger.getAttribute('aria-expanded') === 'true');

      on(trigger, 'click', function () {
        var willOpen = !item.classList.contains('is-open');
        if (willOpen && !item.closest('[data-faq-multiple]')) {
          items.forEach(function (other) {
            if (other !== item && other.parentElement === item.parentElement && other.classList.contains('is-open')) {
              var t = $('.faq-item__question, .faq-question, .faq-trigger, button', other);
              var p = $('.faq-item__answer, .faq-answer, .faq-panel', other) || (t && t.nextElementSibling);
              other.classList.remove('is-open');
              if (t) t.setAttribute('aria-expanded', 'false');
              if (p) p.style.maxHeight = '0px';
            }
          });
        }
        set(willOpen);
      });
    });

    on(window, 'resize', function () {
      $$('.faq-item.is-open').forEach(function (item) {
        var p = $('.faq-item__answer, .faq-answer, .faq-panel', item);
        if (p) p.style.maxHeight = p.scrollHeight + 'px';
      });
    });

    // open item referenced by hash
    if (location.hash) {
      var target = document.getElementById(location.hash.slice(1));
      var item = target && target.closest ? target.closest('.faq-item') : null;
      var trig = item && $('.faq-item__question, .faq-question, .faq-trigger, button', item);
      if (trig && !item.classList.contains('is-open')) trig.click();
    }
  }

  /* ======================================================================
     5. Responsive tables: add data-label from header cells
     ====================================================================== */
  function initTables() {
    $$('.legal-table, .data-table').forEach(function (table) {
      var heads = $$('thead th', table).map(function (th) { return cleanText(th.textContent); });
      if (!heads.length) return;
      $$('tbody tr', table).forEach(function (tr) {
        $$('th, td', tr).forEach(function (cell, i) {
          if (!cell.hasAttribute('data-label') && heads[i]) cell.setAttribute('data-label', heads[i]);
        });
      });
    });
  }

  /* ======================================================================
     6. Cookie consent
     ====================================================================== */
  var Consent = {
    get: function () {
      var c = readJSON(local, CONFIG.consentKey);
      return c && typeof c === 'object' ? c : null;
    },
    set: function (prefs) {
      var data = {
        necessary: true,
        analytics: !!prefs.analytics,
        marketing: !!prefs.marketing,
        version: CONFIG.consentVersion,
        timestamp: new Date().toISOString()
      };
      writeValue(local, CONFIG.consentKey, JSON.stringify(data));
      try {
        document.dispatchEvent(new CustomEvent('bonum:consent', { detail: data }));
      } catch (e) { /* old browsers */ }
      return data;
    }
  };
  window.BonumConsent = Consent;

  function buildCookieMarkup() {
    var banner = document.createElement('div');
    banner.className = 'cookie-banner';
    banner.id = 'cookie-banner';
    banner.setAttribute('role', 'dialog');
    banner.setAttribute('aria-modal', 'false');
    banner.setAttribute('aria-labelledby', 'cookie-banner-title');
    banner.setAttribute('aria-describedby', 'cookie-banner-text');
    banner.hidden = true;
    banner.innerHTML =
      '<div class="cookie-banner__inner">' +
        '<div class="cookie-banner__text">' +
          '<h2 class="cookie-banner__title" id="cookie-banner-title">Ihre Privatsphäre</h2>' +
          '<p id="cookie-banner-text">Wir verwenden notwendige Speicherfunktionen für den Betrieb dieser Website. Optionale Kategorien (Analyse, Marketing) setzen wir nur mit Ihrer Einwilligung ein. Details finden Sie in unserer <a href="' + CONFIG.cookiePolicy + '">Cookie-Richtlinie</a>.</p>' +
        '</div>' +
        '<div class="cookie-banner__actions">' +
          '<button type="button" class="btn btn--primary" data-cookie="accept">Alle akzeptieren</button>' +
          '<button type="button" class="btn btn--outline" data-cookie="necessary">Nur notwendige</button>' +
          '<button type="button" class="btn btn--ghost" data-cookie="customize">Anpassen</button>' +
        '</div>' +
      '</div>';

    var panel = buildCookiePanel();
    document.body.appendChild(banner);
    document.body.appendChild(panel);
    return { banner: banner, panel: panel };
  }

  function buildCookiePanel() {
    var panel = document.createElement('div');
    panel.className = 'cookie-panel';
    panel.id = 'cookie-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-labelledby', 'cookie-panel-title');
    panel.hidden = true;
    panel.innerHTML =
      '<div class="cookie-panel__backdrop" data-cookie="close"></div>' +
      '<div class="cookie-panel__dialog" tabindex="-1">' +
        '<button type="button" class="cookie-panel__close" data-cookie="close" aria-label="Schliessen">&times;</button>' +
        '<h2 id="cookie-panel-title">Cookie-Einstellungen</h2>' +
        '<p>Wählen Sie, welche Kategorien Sie zulassen möchten. Ihre Auswahl können Sie jederzeit über den Link «Cookie-Einstellungen» im Footer ändern.</p>' +
        '<label class="cookie-option"><span><strong>Notwendig</strong><span class="cookie-option__desc">Erforderlich für Grundfunktionen, Sicherheit und die Speicherung Ihrer Cookie-Auswahl. Immer aktiv.</span></span><input type="checkbox" name="necessary" checked disabled></label>' +
        '<label class="cookie-option"><span><strong>Analyse</strong><span class="cookie-option__desc">Hilft uns, die Nutzung der Website anonymisiert zu verstehen und zu verbessern.</span></span><input type="checkbox" name="analytics"></label>' +
        '<label class="cookie-option"><span><strong>Marketing</strong><span class="cookie-option__desc">Ermöglicht personalisierte Inhalte und Reichweitenmessung externer Anbieter.</span></span><input type="checkbox" name="marketing"></label>' +
        '<div class="cookie-panel__actions">' +
          '<button type="button" class="btn btn--outline" data-cookie="necessary">Nur notwendige</button>' +
          '<button type="button" class="btn btn--outline" data-cookie="save">Auswahl speichern</button>' +
          '<button type="button" class="btn btn--primary" data-cookie="accept">Alle akzeptieren</button>' +
        '</div>' +
      '</div>';
    return panel;
  }

  function initCookies() {
    var banner = $('.cookie-banner');
    var panel = $('.cookie-panel');

    if (!banner) {
      var built = buildCookieMarkup();
      banner = built.banner;
      panel = built.panel;
    } else if (!panel) {
      panel = buildCookiePanel();
      document.body.appendChild(panel);
    }

    // classify any pre-authored buttons that lack data-cookie
    $$('button, a.btn, [role="button"]', banner).concat($$('button, a.btn, [role="button"]', panel)).forEach(function (btn) {
      if (btn.hasAttribute('data-cookie')) return;
      var label = cleanText(btn.textContent).toLowerCase();
      var action = null;
      if (/alle\s+akzept/.test(label)) action = 'accept';
      else if (/nur\s+notwendig/.test(label)) action = 'necessary';
      else if (/anpassen|einstellung/.test(label)) action = 'customize';
      else if (/speichern|auswahl/.test(label)) action = 'save';
      else if (/schliess|×|✕|^x$/.test(label)) action = 'close';
      if (action) btn.setAttribute('data-cookie', action);
    });

    var lastFocus = null;

    function checkbox(name) {
      return $('input[type="checkbox"][name="' + name + '"], input[type="checkbox"][data-cookie-category="' + name + '"], input[type="checkbox"]#cookie-' + name, panel);
    }
    function syncPanel() {
      var c = Consent.get() || {};
      var a = checkbox('analytics');
      var m = checkbox('marketing');
      if (a) a.checked = !!c.analytics;
      if (m) m.checked = !!c.marketing;
    }

    function showBanner() {
      banner.hidden = false;
      banner.classList.add('is-visible');
    }
    function hideBanner() {
      banner.classList.remove('is-visible');
      banner.hidden = true;
    }
    function openPanel() {
      lastFocus = document.activeElement;
      syncPanel();
      panel.hidden = false;
      panel.classList.add('is-open');
      lockScroll('cookie');
      var dlg = $('.cookie-panel__dialog', panel) || panel;
      window.setTimeout(function () {
        var first = $(FOCUSABLE, dlg);
        (first || dlg).focus();
      }, 30);
    }
    function closePanel() {
      panel.classList.remove('is-open');
      panel.hidden = true;
      unlockScroll('cookie');
      if (lastFocus && lastFocus.focus) { try { lastFocus.focus(); } catch (e) { /* noop */ } }
    }
    function decide(prefs) {
      Consent.set(prefs);
      hideBanner();
      if (panel.classList.contains('is-open')) closePanel();
    }

    function handle(action) {
      switch (action) {
        case 'accept': decide({ analytics: true, marketing: true }); break;
        case 'necessary': decide({ analytics: false, marketing: false }); break;
        case 'customize': openPanel(); break;
        case 'save':
          decide({
            analytics: !!(checkbox('analytics') && checkbox('analytics').checked),
            marketing: !!(checkbox('marketing') && checkbox('marketing').checked)
          });
          break;
        case 'close': closePanel(); break;
        default: break;
      }
    }

    on(document, 'click', function (e) {
      var el = e.target.closest ? e.target.closest('[data-cookie]') : null;
      if (el && (banner.contains(el) || panel.contains(el))) {
        e.preventDefault();
        handle(el.getAttribute('data-cookie'));
        return;
      }
      var reopen = e.target.closest ? e.target.closest('[data-cookie-settings], .js-cookie-settings, a[href="#cookie-einstellungen"]') : null;
      if (reopen) { e.preventDefault(); openPanel(); }
    });
    on(document, 'keydown', function (e) {
      if (!panel.classList.contains('is-open')) return;
      if (e.key === 'Escape') { closePanel(); return; }
      trapFocus($('.cookie-panel__dialog', panel) || panel, e);
    });

    Consent.open = openPanel;

    if (!Consent.get()) {
      window.setTimeout(showBanner, CONFIG.bannerDelay);
    } else {
      banner.hidden = true;
    }
  }

  /* ======================================================================
     7. Award modal (once per session)
     ====================================================================== */
  function initAwardModal() {
    var modal = $('.award-modal');
    if (!modal) return;

    // always start hidden
    modal.hidden = true;
    modal.classList.remove('is-open');
    if (!modal.hasAttribute('role')) modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-hidden', 'true');

    var dialog = $('.award-modal__dialog', modal) || modal;
    var lastFocus = null;
    var timer = null;

    function seen() {
      try { return (session ? session.getItem(CONFIG.awardKey) : memory[CONFIG.awardKey]) === '1'; } catch (e) { return false; }
    }
    function markSeen() { writeValue(session, CONFIG.awardKey, '1'); }

    function open() {
      if (modal.classList.contains('is-open')) return;
      lastFocus = document.activeElement;
      modal.hidden = false;
      modal.setAttribute('aria-hidden', 'false');
      modal.classList.add('is-open');
      lockScroll('award');
      markSeen();
      window.setTimeout(function () {
        var close = $('.award-modal__close, [data-award-close]', modal);
        (close || dialog).focus();
      }, 40);
    }
    function close() {
      if (!modal.classList.contains('is-open')) return;
      modal.classList.remove('is-open');
      modal.hidden = true;
      modal.setAttribute('aria-hidden', 'true');
      unlockScroll('award');
      if (lastFocus && lastFocus.focus) { try { lastFocus.focus(); } catch (e) { /* noop */ } }
    }

    on(modal, 'click', function (e) {
      var t = e.target;
      if (t === modal || (t.classList && t.classList.contains('award-modal__backdrop'))) { close(); return; }
      var btn = t.closest ? t.closest('.award-modal__close, [data-award-close], [data-dismiss="award"], button, .btn') : null;
      if (btn && modal.contains(btn)) {
        // let real links navigate, but still close
        if (btn.tagName !== 'A' || (btn.getAttribute('href') || '').charAt(0) === '#') e.preventDefault();
        close();
      }
    });
    on(document, 'keydown', function (e) {
      if (!modal.classList.contains('is-open')) return;
      if (e.key === 'Escape') { close(); return; }
      trapFocus(dialog, e);
    });
    $$('[data-award-open]').forEach(function (b) { on(b, 'click', function (e) { e.preventDefault(); open(); }); });

    if (!seen()) {
      timer = window.setTimeout(open, CONFIG.awardDelay);
      on(window, 'pagehide', function () { if (timer) window.clearTimeout(timer); });
    }
  }

  /* ======================================================================
     8. Contact forms -> mailto
     ====================================================================== */
  function fieldLabel(form, el) {
    var label = null;
    if (el.id) {
      try { label = form.querySelector('label[for="' + (window.CSS && CSS.escape ? CSS.escape(el.id) : el.id) + '"]'); } catch (e) { label = null; }
    }
    if (!label && el.closest) label = el.closest('label');
    var text = '';
    if (label) {
      var clone = label.cloneNode(true);
      $$('input, select, textarea, small, .form-hint, .req', clone).forEach(function (n) { n.parentNode.removeChild(n); });
      text = clone.textContent;
    }
    if (!cleanText(text)) text = el.getAttribute('aria-label') || el.getAttribute('placeholder') || el.name || 'Feld';
    return cleanText(text);
  }

  function setStatus(form, msg, type, noLink) {
    var box = $('.form-status', form);
    if (!box) {
      box = document.createElement('div');
      box.className = 'form-status';
      var actions = $('.form-actions', form);
      if (actions && actions.parentNode) actions.parentNode.insertBefore(box, actions.nextSibling);
      else form.appendChild(box);
    }
    box.setAttribute('role', 'status');
    box.setAttribute('aria-live', 'polite');
    box.className = 'form-status' + (type ? ' is-' + type : '');
    box.textContent = '';
    if (msg) {
      box.appendChild(document.createTextNode(msg + ' '));
      if (type === 'success' && !noLink) {
        var a = document.createElement('a');
        a.href = 'mailto:' + CONFIG.email;
        a.textContent = CONFIG.email;
        box.appendChild(a);
      }
    }
  }

  function buildMailto(form) {
    var lines = [];
    var message = [];
    var subjectField = $('[name="subject"], [name="_subject"], [name="betreff"]', form);
    var topic = '';
    var seenGroups = {};

    $$('input, select, textarea', form).forEach(function (el) {
      var type = (el.type || '').toLowerCase();
      var name = el.name || '';
      if (!name || el.disabled) return;
      if (/^(website|url|company_url|_gotcha|hp|honeypot|bot-field)$/i.test(name)) return;
      if (el.closest('.honeypot, .hp-field, .form-hp')) return;
      if (type === 'submit' || type === 'button' || type === 'reset' || type === 'password' || type === 'file') return;
      if (type === 'hidden' && !/^(_?subject|betreff)$/i.test(name)) return;
      if (el === subjectField) return;

      var label = fieldLabel(form, el);
      var value = '';

      if (type === 'checkbox') {
        if (!el.checked) return;
        if (/datenschutz|einwillig|zustimm|privacy|consent|akzept/i.test(name + ' ' + label)) {
          lines.push('Datenschutzerklärung: zur Kenntnis genommen');
          return;
        }
        var grp = seenGroups[name];
        if (grp) return;
        var all = $$('input[type="checkbox"][name="' + name + '"]:checked', form).map(function (c) { return c.value && c.value !== 'on' ? c.value : fieldLabel(form, c); });
        seenGroups[name] = true;
        value = all.join(', ');
      } else if (type === 'radio') {
        if (!el.checked) return;
        value = el.value;
      } else if (el.tagName === 'SELECT') {
        var opt = el.options[el.selectedIndex];
        value = opt ? cleanText(opt.textContent) : el.value;
        if (!el.value) return;
        if (/thema|anliegen|interesse|betreff/i.test(name + ' ' + label) && !topic) topic = value;
      } else {
        value = (el.value || '').trim();
      }
      if (!value) return;

      if (el.tagName === 'TEXTAREA') message.push(label + ':\n' + value);
      else lines.push(label + ': ' + value);
    });

    var subject = '';
    if (subjectField && subjectField.value) subject = subjectField.value;
    else if (form.getAttribute('data-subject')) subject = form.getAttribute('data-subject');
    else subject = 'Anfrage über ' + CONFIG.domain + (topic ? ' – ' + topic : '');

    var body = 'Guten Tag\n\n' + 'über das Kontaktformular auf ' + CONFIG.domain + ' erreicht Sie folgende Anfrage:\n\n' +
      lines.join('\n') + (message.length ? '\n\n' + message.join('\n\n') : '') +
      '\n\n--\nGesendet über ' + CONFIG.domain;

    var maxBody = 1800;
    var encoded = encodeURIComponent(body);
    if (encoded.length > maxBody * 3) {
      while (encodeURIComponent(body).length > maxBody * 3) body = body.slice(0, body.length - 100);
      body += '\n[…gekürzt]';
    }
    return 'mailto:' + CONFIG.email + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
  }

  function initForms() {
    var forms = $$('form').filter(function (f) {
      if (f.hasAttribute('data-no-mailto')) return false;
      if (f.matches('.calculator form, .calc form, [data-calculator], .calculator, .calc, #calculator-form, #festgeld-calculator-form')) return false;
      if (f.closest('.calculator, .calc, [data-calculator]')) return false;
      if (f.matches('[data-contact-form], .contact-form, .form--contact, [data-mailto], #contact-form, #kontaktformular')) return true;
      return !!$('[name="email"], [type="email"]', f);
    });

    forms.forEach(function (form) {
      form.setAttribute('novalidate', 'novalidate');
      if (!form.getAttribute('action')) form.setAttribute('action', 'mailto:' + CONFIG.email);

      on(form, 'submit', function (e) {
        e.preventDefault();

        var hp = $('input[name="website"], input[name="company_url"], input[name="_gotcha"], input[name="hp"], input[name="bot-field"], .honeypot input, .hp-field input, .form-hp input', form);
        if (hp && String(hp.value || '').trim() !== '') {
          // bot: pretend success, send nothing
          setStatus(form, 'Vielen Dank für Ihre Nachricht.', 'success', true);
          return;
        }

        var invalid = null;
        $$('input, select, textarea', form).forEach(function (el) {
          if (!invalid && el.willValidate && !el.checkValidity()) invalid = el;
        });
        if (invalid) {
          setStatus(form, 'Bitte prüfen Sie Ihre Angaben: ' + fieldLabel(form, invalid) + '.', 'error');
          try { invalid.focus(); } catch (err) { /* noop */ }
          if (invalid.reportValidity) invalid.reportValidity();
          return;
        }

        setStatus(form, 'Ihr E-Mail-Programm wird geöffnet. Bitte senden Sie die vorbereitete Nachricht ab. Sollte sich nichts öffnen, schreiben Sie uns direkt an', 'success');
        window.location.href = buildMailto(form);
      });
    });
  }

  /* ======================================================================
     9. Festgeld calculator (illustrative only)
     ====================================================================== */
  function initCalculator() {
    var calc = $('[data-calculator], .calculator, .calc, #festgeld-calculator, #calculator');
    if (!calc) return;

    var defaults = { '6': 2.15, '12': 2.65, '24': 3.05, '36': 3.35, '60': 3.65 };
    var rates = defaults;
    try {
      var custom = calc.getAttribute('data-rates');
      if (custom) rates = JSON.parse(custom);
    } catch (e) { rates = defaults; }

    var currency = calc.getAttribute('data-currency') || 'EUR';
    var fmtMoney, fmtPct;
    try {
      fmtMoney = new Intl.NumberFormat('de-CH', { style: 'currency', currency: currency, minimumFractionDigits: 2, maximumFractionDigits: 2 });
      fmtPct = new Intl.NumberFormat('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    } catch (e) {
      fmtMoney = { format: function (n) { return currency + ' ' + n.toFixed(2); } };
      fmtPct = { format: function (n) { return n.toFixed(2); } };
    }

    function field(selectors) { return $(selectors, calc); }
    var amountEl = field('[data-calc="amount"], #calc-amount, input[name="amount"], input[name="betrag"], input[name="anlagebetrag"]');
    var termEl = field('[data-calc="term"], #calc-term, [name="term"], [name="laufzeit"]');
    var rateEl = field('[data-calc="rate"], #calc-rate, input[name="rate"], input[name="zins"], input[name="zinssatz"]');

    var outInterest = $$('[data-calc-out="interest"], [data-calc-interest], #calc-interest, #calc-zinsen, .js-calc-interest', calc);
    var outTotal = $$('[data-calc-out="total"], [data-calc-total], #calc-total, #calc-endbetrag, .js-calc-total', calc);
    var outRate = $$('[data-calc-out="rate"], [data-calc-rate], #calc-rate-out, #calc-zinssatz, .js-calc-rate', calc);
    var outAmount = $$('[data-calc-out="amount"], #calc-amount-out, .js-calc-amount', calc);
    var outTerm = $$('[data-calc-out="term"], #calc-term-out, .js-calc-term', calc);
    var amountLabel = $$('[data-calc-amount-label]', calc);

    function setAll(list, text) { list.forEach(function (el) { el.textContent = text; }); }
    function num(v) {
      if (typeof v === 'number') return v;
      var s = String(v || '').replace(/[’'\s]/g, '').replace(/CHF|EUR|€/gi, '');
      if (/,\d{1,2}$/.test(s) && s.indexOf('.') === -1) s = s.replace(',', '.');
      else s = s.replace(/,/g, '');
      var n = parseFloat(s);
      return isNaN(n) ? NaN : n;
    }
    function termMonths() {
      if (!termEl) return 12;
      var raw = termEl.tagName === 'SELECT' && termEl.options[termEl.selectedIndex] ? (termEl.value || termEl.options[termEl.selectedIndex].text) : termEl.value;
      var n = num(String(raw).replace(/[^\d.,]/g, ''));
      if (!isNaN(n) && /jahr/i.test(String(raw))) n = n * 12;
      return n;
    }
    function rateFor(months) {
      if (rateEl && String(rateEl.value).trim() !== '') {
        var r = num(rateEl.value);
        if (!isNaN(r)) return r;
      }
      if (termEl && termEl.tagName === 'SELECT') {
        var opt = termEl.options[termEl.selectedIndex];
        var dr = opt && (opt.getAttribute('data-rate') || opt.getAttribute('data-zins'));
        if (dr) { var d = num(dr); if (!isNaN(d)) return d; }
      }
      if (rates[String(months)] != null) return Number(rates[String(months)]);
      var keys = Object.keys(rates).map(Number).sort(function (a, b) { return a - b; });
      var pick = keys[0];
      keys.forEach(function (k) { if (months >= k) pick = k; });
      return Number(rates[String(pick)]);
    }

    function render() {
      var amount = amountEl ? num(amountEl.value) : NaN;
      var months = termMonths();
      var rate = rateFor(months);
      var dash = '–';

      if (amountLabel.length && !isNaN(amount)) setAll(amountLabel, fmtMoney.format(amount).replace(/\.00$/, ''));

      if (isNaN(amount) || amount <= 0 || isNaN(months) || months <= 0 || isNaN(rate)) {
        setAll(outInterest, dash); setAll(outTotal, dash); setAll(outRate, isNaN(rate) ? dash : fmtPct.format(rate) + ' % p. a.');
        setAll(outAmount, dash); setAll(outTerm, dash);
        return;
      }
      // simple interest, paid at maturity (illustrative)
      var interest = amount * (rate / 100) * (months / 12);
      var total = amount + interest;

      setAll(outInterest, fmtMoney.format(interest));
      setAll(outTotal, fmtMoney.format(total));
      setAll(outRate, fmtPct.format(rate) + ' % p. a.');
      setAll(outAmount, fmtMoney.format(amount));
      setAll(outTerm, months % 12 === 0 ? (months / 12) + (months === 12 ? ' Jahr' : ' Jahre') : months + ' Monate');
      calc.setAttribute('data-calculated', 'true');
    }

    [amountEl, termEl, rateEl].forEach(function (el) {
      if (!el) return;
      on(el, 'input', render);
      on(el, 'change', render);
    });
    var form = calc.tagName === 'FORM' ? calc : $('form', calc);
    if (form) {
      on(form, 'submit', function (e) { e.preventDefault(); render(); });
      $$('button[type="reset"]', form).forEach(function (b) { on(b, 'click', function () { window.setTimeout(render, 0); }); });
    }
    $$('[data-calc-submit], .js-calc-submit', calc).forEach(function (b) {
      on(b, 'click', function (e) { e.preventDefault(); render(); });
    });
    render();
  }

  /* ======================================================================
     10. Misc
     ====================================================================== */
  function initMisc() {
    var y = String(new Date().getFullYear());
    $$('[data-year], .js-year').forEach(function (el) { el.textContent = y; });
    // external links
    $$('a[target="_blank"]').forEach(function (a) {
      var rel = (a.getAttribute('rel') || '').split(/\s+/);
      ['noopener', 'noreferrer'].forEach(function (r) { if (rel.indexOf(r) === -1) rel.push(r); });
      a.setAttribute('rel', rel.join(' ').trim());
    });
  }

  /* ----- boot ------------------------------------------------------------ */
  ready(function () {
    initHeader();
    initAnchors();
    initTables();
    initFaq();
    initCookies();
    initAwardModal();
    initForms();
    initCalculator();
    initMisc();
    initReveal();
  });
})();
