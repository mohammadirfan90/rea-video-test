/* ========================================================================
   Smritikotha — A Night in Red · interactive trailer breakdown
   ===================================================================== */
(function () {
  'use strict';

  var DATA = JSON.parse(document.getElementById('artifact-data').textContent);
  var SHOTS = DATA.shots || [];
  var DURATION = DATA.source.duration || 138.68;

  /* ---------------------------------------------------------- utilities */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
  function fmtTime(v) {
    var m = Math.floor(v / 60);
    var s = v - m * 60;
    return m + ':' + (s < 10 ? '0' : '') + s.toFixed(1);
  }
  function pct(v) { return Math.round(v * 100); }
  function num(v, dp) {
    if (v == null) return '—';
    var n = Number(v);
    if (!isFinite(n)) return '—';
    return n.toFixed(dp == null ? 2 : dp);
  }
  function words(s, n) {
    if (!s) return '';
    var w = String(s).split(/\s+/);
    return w.length > n ? w.slice(0, n).join(' ') + '…' : String(s);
  }
  function titleCase(s) {
    return String(s || '').replace(/[_-]+/g, ' ').replace(/\b\w/g, function (c) {
      return c.toUpperCase();
    });
  }
  /* media paths are relative to out/trailer/ */
  var MEDIA_BASE = DATA.mediaBase || '../out/trailer/';
  function media(p) {
    if (!p) return '';
    return MEDIA_BASE + String(p).replace(/^\/+/, '');
  }

  /* ------------------------------------------------------------- search */
  var INDEX = [];
  SHOTS.forEach(function (s) {
    INDEX.push({
      kind: 'shot',
      title: 'Shot ' + s.n + ' · ' + (s.description ? words(s.description, 9) : s.id),
      sub: fmtTime(s.start) + '–' + fmtTime(s.end) + ' · ' + s.labelName,
      hay: [s.id, s.description, s.labelName, s.verdict, s.scene,
            (s.evidence || []).join(' '), s.shotSize, s.supportLabel, s.move]
        .join(' ').toLowerCase(),
      go: function () { focusShot(s.id); }
    });
  });
  (DATA.cast.characters || []).forEach(function (c) {
    INDEX.push({
      kind: 'character', title: c.name, sub: 'Character ' + c.id + ' · ' + (c.role || ''),
      hay: (c.look + ' ' + (c.role || '') + ' ' + c.name).toLowerCase(),
      go: function () { goTo('#characters'); }
    });
  });
  (DATA.cast.scenes || []).forEach(function (sc) {
    INDEX.push({
      kind: 'scene', title: sc.where, sub: 'Scene ' + sc.id + ' · ' + (sc.when || ''),
      hay: (sc.look + ' ' + sc.where + ' ' + (sc.when || '')).toLowerCase(),
      go: function () { goTo('#scenes'); }
    });
  });
  (DATA.audio.musicPlan || []).forEach(function (m) {
    INDEX.push({
      kind: 'audio', title: 'Music bed — ' + m.what, sub: 'Audio plan',
      hay: (m.what + ' ' + m.how + ' ' + m.rule).toLowerCase(),
      go: function () { goTo('#sound'); }
    });
  });
  INDEX.forEach(function (i) { i.hay = i.hay.toLowerCase(); });

  /* =====================================================================
     Chrome: nav, progress, search
     ===================================================================== */
  var SECTIONS = [
    ['overview', 'Overview'],
    ['verdict', 'Verdict'],
    ['shot-map', 'Shot map'],
    ['shots', 'Shot explorer'],
    ['cast', 'Cast'],
    ['sound', 'Sound'],
    ['packaging', 'Packaging'],
    ['craft', 'Craft'],
    ['remake', 'Remake'],
    ['confidence', 'Open questions']
  ];

  function buildNav() {
    var nav = $('#nav');
    SECTIONS.forEach(function (s) {
      var a = el('a', 'nav__link', esc(s[1]));
      a.href = '#' + s[0];
      a.dataset.target = s[0];
      nav.appendChild(a);
    });
  }

  function goTo(hash) {
    var t = document.querySelector(hash);
    if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function initScrollSpy() {
    var links = Array.prototype.slice.call(document.querySelectorAll('.nav__link'));
    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        links.forEach(function (a) {
          a.classList.toggle('is-active', a.dataset.target === e.target.id);
        });
      });
    }, { rootMargin: '-72px 0px -70% 0px', threshold: 0 });
    SECTIONS.forEach(function (s) {
      var t = document.getElementById(s[0]);
      if (t) obs.observe(t);
    });

    var bar = $('#progress-bar');
    function onScroll() {
      var h = document.documentElement.scrollHeight - window.innerHeight;
      var p = h > 0 ? window.scrollY / h : 0;
      bar.style.width = (Math.min(1, Math.max(0, p)) * 100) + '%';
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  function initSearch() {
    var input = $('#search');
    var box = $('#search-results');
    var active = -1;

    function render(q) {
      box.innerHTML = '';
      var query = q.trim().toLowerCase();
      if (!query) { box.classList.remove('is-open'); input.setAttribute('aria-expanded', 'false'); return; }

      var hits = [];
      for (var i = 0; i < INDEX.length && hits.length < 14; i++) {
        if (INDEX[i].hay.indexOf(query) !== -1) hits.push(INDEX[i]);
      }
      if (!hits.length) {
        box.appendChild(el('div', 'sr__empty', 'No matches for &ldquo;' + esc(query) + '&rdquo;'));
      } else {
        hits.forEach(function (h) {
          var a = el('a', 'sr__item');
          a.innerHTML = '<div class="sr__t">' + highlight(h.title, query) + '</div>' +
                        '<div class="sr__s">' + esc(h.sub) + '</div>';
          a.addEventListener('click', function (ev) {
            ev.preventDefault();
            box.classList.remove('is-open');
            input.value = '';
            h.go();
          });
          box.appendChild(a);
        });
      }
      active = -1;
      box.classList.add('is-open');
      input.setAttribute('aria-expanded', 'true');
    }

    function highlight(text, q) {
      var i = text.toLowerCase().indexOf(q);
      if (i === -1) return esc(text);
      return esc(text.slice(0, i)) + '<mark>' + esc(text.slice(i, i + q.length)) +
             '</mark>' + esc(text.slice(i + q.length));
    }

    input.addEventListener('input', function () { render(input.value); });
    input.addEventListener('focus', function () { if (input.value.trim()) render(input.value); });
    document.addEventListener('click', function (e) {
      if (!e.target.closest('.chrome__search')) {
        box.classList.remove('is-open');
        input.setAttribute('aria-expanded', 'false');
      }
    });
    input.addEventListener('keydown', function (e) {
      var items = box.querySelectorAll('.sr__item');
      if (e.key === 'Escape') {
        box.classList.remove('is-open'); input.blur(); return;
      }
      if (!items.length) return;
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        active += (e.key === 'ArrowDown' ? 1 : -1);
        if (active < 0) active = items.length - 1;
        if (active >= items.length) active = 0;
        items.forEach(function (n, i) { n.classList.toggle('is-active', i === active); });
        items[active].scrollIntoView({ block: 'nearest' });
      }
      if (e.key === 'Enter' && active >= 0 && items[active]) {
        e.preventDefault();
        items[active].click();
      }
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === '/' && document.activeElement !== input) {
        var tag = (document.activeElement || {}).tagName;
        if (tag !== 'INPUT' && tag !== 'TEXTAREA') {
          e.preventDefault();
          input.focus();
          input.select();
        }
      }
    });
  }

  /* =====================================================================
     Hero + verdict
     ===================================================================== */
  function renderHero() {
    var s = DATA.source;
    $('#hero-sub').innerHTML =
      'A ' + fmtTime(s.duration) + ' wedding trailer for the Srutikotha venue, reverse-engineered shot by shot: ' +
      'what each frame was actually made of, how it was lit and cut, and what it would take to rebuild it. ' +
      'Every shot was reviewed by eye and every conclusion is traced to its evidence.';

    var v = DATA.verdict;
    var facts = [
      ['Resolution', s.width + '×' + s.height + ' · ' + num(s.fps, 3) + ' fps'],
      ['Duration', num(s.duration, 2) + 's'],
      ['Shots', v.shotCount + ' · avg ' + num(v.avgShotS, 2) + 's'],
      ['Confidence', num(v.confidence, 3)],
      ['Review', (DATA.meta.review.by || 'agent') + ' · ' + (DATA.meta.review.shots || 0) + '/' + (DATA.meta.review.of || 0) + ' shots']
    ];
    var fbox = $('#hero-facts');
    facts.forEach(function (f) {
      fbox.appendChild(el('span', 'fact', esc(f[0]) + ' <b>' + esc(f[1]) + '</b>'));
    });
    var zeroAI = !(v.mix || []).some(function (m) { return m.label === 'ai_video'; });
    fbox.appendChild(el('span', 'fact ' + (zeroAI ? 'fact--ok' : 'fact--warn'),
      zeroAI ? '<b>Zero</b> AI-generated video' : '<b>Some</b> AI-generated video'));

    $('#hero-strip').src = media('storyboard.jpg');
    $('#hero-strip').style.cursor = 'zoom-in';
    $('#hero-strip').title = 'Click to view the full contact sheet';

    $('#verdict-text').textContent = v.text || '';

    var bar = $('#mix-bar');
    var leg = $('#mix-legend');
    (v.mix || []).forEach(function (m) {
      var seg = el('div', 'mix__seg');
      seg.style.width = (m.ratio * 100) + '%';
      seg.style.background = colorFor(m.label);
      seg.title = m.label_zh + ' — ' + num(m.seconds, 2) + 's (' + pct(m.ratio) + '%)';
      bar.appendChild(seg);

      var item = el('span', 'mix__item');
      item.innerHTML = '<span class="mix__dot" style="background:' + colorFor(m.label) + '"></span>' +
        esc(m.label_zh) + ' <b>' + pct(m.ratio) + '%</b> · ' + num(m.seconds, 1) + 's';
      leg.appendChild(item);
    });

    var stats = [
      ['Runtime', num(DATA.source.duration, 2) + ' s'],
      ['Cuts', Object.keys(v.transitions || {}).map(function (k) {
        return v.transitions[k] + ' ' + k;
      }).join(' · ')],
      ['AI-generated', zeroAI ? 'none detected' : 'present'],
      ['Real material', (DATA.verdict.realMaterial.kinds ? Object.keys(DATA.verdict.realMaterial.kinds).join(', ') : '—')],
      ['Music', num(DATA.audio.bpm, 1) + ' BPM · ' + (DATA.audio.key || '')],
      ['Voice', DATA.audio.voicePresent ? 'present' : 'none — music only'],
      ['Mix', 'music ' + pct(DATA.audio.musicRatio) + '% of runtime']
    ];
    var sbox = $('#verdict-stats');
    stats.forEach(function (row) {
      sbox.appendChild(el('div', 'stat',
        '<span class="stat__k">' + esc(row[0]) + '</span><span class="stat__v">' + esc(row[1]) + '</span>'));
    });
  }

  function colorFor(label) {
    var found = SHOTS.filter(function (s) { return s.label === label; })[0];
    return (found && found.color) || '#64748b';
  }

  /* =====================================================================
     Timeline strip
     ===================================================================== */
  function renderTimeline() {
    var t = $('#timeline-strip');
    SHOTS.forEach(function (s) {
      var seg = el('div', 'timeline__seg');
      seg.style.left = (s.start / DURATION * 100) + '%';
      seg.style.width = Math.max(0.15, (s.dur / DURATION * 100)) + '%';
      seg.style.background = s.color;
      seg.title = 'Shot ' + s.n + ' · ' + fmtTime(s.start) + '–' + fmtTime(s.end) +
                  ' · ' + s.labelName + ' · ' + (s.description ? words(s.description, 8) : '');
      seg.addEventListener('click', function () { focusShot(s.id); });
      seg.style.cursor = 'pointer';
      t.appendChild(seg);
    });
    for (var m = 0; m <= 4; m++) {
      var tick = el('div', 'timeline__tick');
      tick.style.left = (m * 25) + '%';
      t.appendChild(tick);
    }
    (DATA.audio.musicSegments || []).forEach(function (seg) {
      var mark = el('div', 'timeline__mark');
      mark.style.left = (seg[0] / DURATION * 100) + '%';
      mark.title = 'Music bed starts';
      t.appendChild(mark);
    });
  }

  /* =====================================================================
     Shot explorer — filters + list
     ===================================================================== */
  var filters = { labels: {}, scene: '', size: '', camera: '', light: '' };

  function uniq(arr) {
    var seen = {}, out = [];
    arr.forEach(function (v) {
      if (v == null || v === '') return;
      if (seen[v]) return;
      seen[v] = 1; out.push(v);
    });
    return out.sort();
  }

  function buildFilters() {
    var counts = {};
    SHOTS.forEach(function (s) {
      counts[s.label] = (counts[s.label] || 0) + 1;
    });
    var box = $('#filter-labels');
    Object.keys(counts).forEach(function (lab) {
      var sample = SHOTS.filter(function (s) { return s.label === lab; })[0];
      var chip = el('button', 'chip');
      chip.type = 'button';
      chip.dataset.label = lab;
      chip.innerHTML = '<span class="chip__dot" style="background:' + sample.color + '"></span>' +
        esc(sample.labelName) + ' <span class="chip__n">' + counts[lab] + '</span>';
      chip.addEventListener('click', function () {
        filters.labels[lab] = !filters.labels[lab];
        chip.classList.toggle('is-on', !!filters.labels[lab]);
        renderShots();
      });
      box.appendChild(chip);
    });

    fillSelect('#filter-scene', 'All locations', uniq(SHOTS.map(function (s) { return s.scene; })), function (v) {
      return v ? (sceneName(v) || v) : 'All locations';
    });
    fillSelect('#filter-size', 'All shot sizes', uniq(SHOTS.map(function (s) { return s.shotSize; })));
    fillSelect('#filter-camera', 'All camera support', uniq(SHOTS.map(function (s) { return s.supportLabel; })));
    fillSelect('#filter-light', 'All lighting setups', uniq(SHOTS.map(function (s) { return s.lightSetup; })), function (v) {
      return v ? titleCase(v) : 'All lighting setups';
    });

    $('#filter-scene').addEventListener('change', function (e) {
      filters.scene = e.target.value; renderShots();
    });
    $('#filter-size').addEventListener('change', function (e) {
      filters.size = e.target.value; renderShots();
    });
    $('#filter-camera').addEventListener('change', function (e) {
      filters.camera = e.target.value; renderShots();
    });
    $('#filter-light').addEventListener('change', function (e) {
      filters.light = e.target.value; renderShots();
    });
    $('#reset-filters').addEventListener('click', function () {
      filters = { labels: {}, scene: '', size: '', camera: '', light: '' };
      Array.prototype.forEach.call(document.querySelectorAll('.chip'), function (c) {
        c.classList.remove('is-on');
      });
      ['#filter-scene', '#filter-size', '#filter-camera', '#filter-light'].forEach(function (s) {
        $(s).value = '';
      });
      renderShots();
    });
  }

  function fillSelect(sel, allLabel, values, labeller) {
    var s = $(sel);
    s.innerHTML = '';
    var o0 = el('option', null, esc(allLabel));
    o0.value = '';
    s.appendChild(o0);
    values.forEach(function (v) {
      var o = el('option', null, esc(labeller ? labeller(v) : titleCase(v)));
      o.value = v;
      s.appendChild(o);
    });
  }

  function sceneName(id) {
    var sc = (DATA.cast.scenes || []).filter(function (s) { return s.id === id; })[0];
    return sc ? sc.where : id;
  }

  function visibleShots() {
    var anyLabel = Object.keys(filters.labels).some(function (k) { return filters.labels[k]; });
    return SHOTS.filter(function (s) {
      if (anyLabel && !filters.labels[s.label]) return false;
      if (filters.scene && s.scene !== filters.scene) return false;
      if (filters.size && s.shotSize !== filters.size) return false;
      if (filters.camera && s.supportLabel !== filters.camera) return false;
      if (filters.light && s.lightSetup !== filters.light) return false;
      return true;
    });
  }

  function renderShots() {
    var list = $('#shot-list');
    var rows = visibleShots();
    list.innerHTML = '';
    $('#result-count').textContent = rows.length + ' of ' + SHOTS.length + ' shots · ' +
      num(rows.reduce(function (a, s) { return a + s.dur; }, 0), 1) + 's';

    if (!rows.length) {
      list.appendChild(el('div', 'sr__empty', 'No shots match these filters.'));
      return;
    }
    rows.forEach(function (s) { list.appendChild(shotRow(s)); });
  }

  function shotRow(s) {
    var row = el('div', 'shot');
    row.id = 'row-' + s.id;
    row.dataset.shot = s.id;

    var n = el('div', 'shot__n', String(s.n).padStart(2, '0'));
    var time = el('div', 'shot__time', fmtTime(s.start) + '–' + fmtTime(s.end));

    var desc = el('div', 'shot__desc');
    desc.appendChild(el('div', 'shot__title', esc(s.description ? words(s.description, 14) : s.id)));
    var meta = el('div', 'shot__meta');
    if (s.scene) meta.appendChild(el('span', 'pill pill--ghost', esc(sceneName(s.scene) || s.scene)));
    if (s.shotSize) meta.appendChild(el('span', 'pill pill--ghost', esc(titleCase(s.shotSize))));
    if (s.userCorrected) meta.appendChild(el('span', 'pill pill--ok', '✓ reviewed'));
    if (s.layers && s.layers.length) meta.appendChild(el('span', 'pill pill--ghost', esc(s.layers.join(', '))));
    desc.appendChild(meta);

    var label = el('div', 'shot__label');
    var lp = el('span', 'pill pill--label', esc(s.labelName));
    lp.style.background = s.color;
    lp.title = 'confidence ' + num(s.conf, 2) + ' · decided by ' + (s.decidedBy || 'tool');
    label.appendChild(lp);

    var size = el('div', 'shot__size', esc(s.shotSize ? titleCase(s.shotSize) : '—'));
    var cam = el('div', 'shot__cam', esc(cameraLabel(s)));
    var chev = el('div', 'shot__chev', '›');

    row.appendChild(n);
    row.appendChild(time);
    row.appendChild(desc);
    row.appendChild(label);
    row.appendChild(size);
    row.appendChild(cam);
    row.appendChild(chev);

    var detail = shotDetail(s);
    row.appendChild(detail);

    row.addEventListener('click', function (ev) {
      if (ev.target.closest('.detail__media img') || ev.target.closest('.detail__frames img')) return;
      row.classList.toggle('is-open');
      chev.textContent = row.classList.contains('is-open') ? '⌄' : '›';
    });
    return row;
  }

  function cameraLabel(s) {
    var bits = [];
    if (s.supportLabel) bits.push(s.supportLabel);
    if (s.move && s.move !== 'static') bits.push(s.move);
    else if (s.move === 'static') bits.push('static');
    return bits.join(' · ') || '—';
  }

  function shotDetail(s) {
    var d = el('div', 'shot__detail');
    var box = el('div', 'detail');

    var top = el('div', 'detail__top');
    var mediaBox = el('div', 'detail__media');
    var sheet = el('img');
    sheet.src = media(s.sheet);
    sheet.alt = 'Contact sheet for shot ' + s.n + ' — first, middle and last frame';
    sheet.loading = 'lazy';
    mediaBox.appendChild(sheet);

    var frames = el('div', 'detail__frames');
    [['first', s.first, 'first frame'], ['strip', s.strip, 'strip'], ['last', s.last, 'last frame']]
      .forEach(function (f) {
        if (!f[1]) return;
        var im = el('img');
        im.src = media(f[1]);
        im.alt = 'Shot ' + s.n + ' ' + f[2];
        im.loading = 'lazy';
        frames.appendChild(im);
      });
    mediaBox.appendChild(frames);
    top.appendChild(mediaBox);

    var body = el('div', 'detail__body');
    body.appendChild(el('div', 'detail__desc', esc(s.description || '')));

    var kv = el('div', 'kv');
    addKv(kv, 'Time', fmtTime(s.start) + ' – ' + fmtTime(s.end) + '  (' + num(s.dur, 2) + 's)');
    addKv(kv, 'Method', s.labelName + ' · confidence ' + num(s.conf, 2) +
      (s.decidedBy ? ' · ' + s.decidedBy : ''));
    addKv(kv, 'Framing', [titleCase(s.shotSize), s.position ? titleCase(s.position) : null,
      s.subject ? titleCase(s.subject) : null, s.cameraAngle ? titleCase(s.cameraAngle) : null]
      .filter(Boolean).join(' · ') || '—');
    addKv(kv, 'Camera', cameraLabel(s) + (s.shake != null ? ' · shake ' + num(s.shake, 2) : ''));
    addKv(kv, 'Lighting', [s.lightSetup ? titleCase(s.lightSetup) : null,
      s.keySide ? 'key ' + s.keySide : null,
      s.ratio != null ? 'ratio ' + num(s.ratio, 2) + ':1' : null,
      s.topBottom != null ? 'top/bot ' + num(s.topBottom, 2) : null,
      s.bgBlur != null ? 'bg blur ' + num(s.bgBlur, 2) : null]
      .filter(Boolean).join(' · ') || '—');
    addKv(kv, 'Motion', 'zoom ' + num(s.zoom, 3) + '/s · pan ' + num(s.pan, 0) + 'px/s @ ' +
      num(s.panDir, 0) + '° · Ken Burns ' + num(s.kenburns, 2));
    addKv(kv, 'Transition', (s.transition || 'cut') + ' · boundary ' + num(s.boundary, 2));
    if (s.verdict) addKv(kv, 'Tool verdict', s.verdict);
    body.appendChild(kv);

    if (s.evidence && s.evidence.length) {
      var ev = el('div', 'evidence');
      ev.appendChild(el('div', 'evidence__t', 'Evidence'));
      var ul = el('ul');
      s.evidence.forEach(function (e) { ul.appendChild(el('li', null, esc(e))); });
      ev.appendChild(ul);
      body.appendChild(ev);
    }

    if (s.userNote) {
      var un = el('div', 'evidence');
      un.appendChild(el('div', 'evidence__t', 'Reviewer note'));
      un.appendChild(el('div', 'shot__meta', esc(s.userNote)));
      body.appendChild(un);
    }

    if (s.imagePrompt || s.videoPrompt) {
      var pr = el('div', 'prompt');
      pr.appendChild(el('div', 'prompt__t', 'Remake prompt'));
      if (s.imagePrompt) pr.appendChild(el('div', 'prompt__b', esc(s.imagePrompt)));
      if (s.videoPrompt) {
        pr.appendChild(el('div', 'prompt__t', 'Video prompt'));
        pr.appendChild(el('div', 'prompt__b', esc(s.videoPrompt)));
      }
      body.appendChild(pr);
    }

    top.appendChild(body);
    box.appendChild(top);
    d.appendChild(box);
    return d;
  }

  function addKv(kv, k, v) {
    kv.appendChild(el('div', 'kv__k', esc(k)));
    kv.appendChild(el('div', 'kv__v', esc(v == null || v === '' ? '—' : v)));
  }

  function focusShot(id) {
    var row = document.getElementById('row-' + id);
    if (!row) {
      $('#reset-filters').click();
      row = document.getElementById('row-' + id);
      if (!row) return;
    }
    row.classList.add('is-open');
    var chev = row.querySelector('.shot__chev');
    if (chev) chev.textContent = '⌄';
    row.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  /* =====================================================================
     Cast / scenes / props
     ===================================================================== */
  function renderCast() {
    var cbox = $('#characters');
    (DATA.cast.characters || []).forEach(function (c) {
      var e = el('div', 'entity');
      var h = el('div', 'entity__h');
      h.appendChild(el('span', 'entity__id', esc(c.id)));
      h.appendChild(el('span', 'entity__n', esc(c.name)));
      e.appendChild(h);
      if (c.role) e.appendChild(el('div', 'entity__role', esc(c.role)));
      e.appendChild(el('div', 'entity__look', esc(c.look || '')));
      cbox.appendChild(e);
    });

    var sbox = $('#scenes');
    (DATA.cast.scenes || []).forEach(function (sc) {
      var e = el('div', 'entity');
      var h = el('div', 'entity__h');
      h.appendChild(el('span', 'entity__id', esc(sc.id)));
      h.appendChild(el('span', 'entity__n', esc(sc.where)));
      e.appendChild(h);
      if (sc.when) e.appendChild(el('div', 'entity__role', esc(sc.when)));
      e.appendChild(el('div', 'entity__look', esc(sc.look || '')));

      var mine = SHOTS.filter(function (s) { return s.scene === sc.id; });
      if (mine.length) {
        var row = el('div', 'scene__shots');
        mine.forEach(function (s) {
          var b = el('span', 'scene__shot', String(s.n));
          b.title = 'Shot ' + s.n + ' · ' + fmtTime(s.start) + ' · ' + words(s.description, 10);
          b.addEventListener('click', function () { focusShot(s.id); });
          row.appendChild(b);
        });
        e.appendChild(row);
      }
      sbox.appendChild(e);
    });

    var pbox = $('#props');
    (DATA.cast.props || []).forEach(function (p) {
      var e = el('div', 'entity');
      var name = p.name || p.look || p.description || JSON.stringify(p);
      e.appendChild(el('div', 'entity__n', esc(name)));
      var note = p.note || p.description || p.look;
      if (note && note !== name) e.appendChild(el('div', 'entity__look', esc(note)));
      if (p.where) e.appendChild(el('div', 'entity__role', esc(p.where)));
      pbox.appendChild(e);
    });
  }

  /* =====================================================================
     Audio
     ===================================================================== */
  function renderAudio() {
    var a = DATA.audio;
    var cards = $('#audio-cards');

    // music source card
    var c1 = el('div', 'card card--pad');
    c1.appendChild(el('div', 'section__eyebrow', 'Music source'));
    c1.appendChild(el('div', 'entity__n', esc(a.musicSource.source_zh || 'to confirm')));
    c1.appendChild(el('div', 'entity__role',
      'Stock library ' + pct((a.musicSource.probs || {}).existing_library) + '% · AI-generated ' +
      pct((a.musicSource.probs || {}).ai_generated) + '% · popular song ' +
      pct((a.musicSource.probs || {}).popular_song) + '%'));
    var pr = el('div');
    pr.style.marginTop = '12px';
    var probs = a.musicSource.probs || {};
    Object.keys(probs).forEach(function (k) {
      var row = el('div', 'prob-row');
      row.innerHTML = '<span class="prob-row__k">' + esc(titleCase(k)) + '</span>' +
        '<span class="prob-row__bar"><span class="prob-row__fill" style="width:' + pct(probs[k]) + '%"></span></span>' +
        '<span class="prob-row__v">' + pct(probs[k]) + '%</span>';
      pr.appendChild(row);
    });
    c1.appendChild(pr);
    if (a.musicSource.how_to_confirm && a.musicSource.how_to_confirm.length) {
      var h = el('div', 'evidence');
      h.appendChild(el('div', 'evidence__t', 'How to confirm'));
      var ul = el('ul');
      a.musicSource.how_to_confirm.forEach(function (x) { ul.appendChild(el('li', null, esc(x))); });
      h.appendChild(ul);
      c1.appendChild(h);
    }
    cards.appendChild(c1);

    // sfx + voice card
    var c2 = el('div', 'card card--pad');
    c2.appendChild(el('div', 'section__eyebrow', 'Voice & effects'));
    c2.appendChild(el('div', 'entity__n', a.voicePresent ? 'Voice present' : 'No voice — music only'));
    c2.appendChild(el('div', 'entity__role',
      'Music covers ' + pct(a.musicRatio) + ' of the runtime; ' + pct(a.silence * 100) +
      '% of the file is silent. Source of effects: ' + esc(a.sfxSource.source_zh || '—') + '.'));
    if (a.sfx && a.sfx.length) {
      var t = el('div', 'evidence');
      t.appendChild(el('div', 'evidence__t', 'Sound-effect candidates (low confidence)'));
      var u2 = el('ul');
      a.sfx.forEach(function (s) {
        u2.appendChild(el('li', null,
          fmtTime(s.t) + ' — ' + esc(s.type) + ' (' + esc(s.confidence) + '), anchored to "' +
          esc(s.anchor || '') + '". Both anchors sit on stickers the tool misread as overlays, ' +
          'so these are weak candidates, not confirmed effects.'));
      });
      t.appendChild(u2);
      c2.appendChild(t);
    }
    cards.appendChild(c2);

    $('#bpm-n').textContent = num(a.bpm, 1) + ' BPM';
    $('#bpm-l').textContent = (a.key || '') + ' · beat strength ' + num(a.beatStrength, 2) +
      ' · alternatives ' + (a.bpmAlts || []).map(function (b) { return num(b, 1); }).join(', ') +
      ' · ' + (DATA.aspects.editingLines || []).length ? '' : '';

    $('#audio-wave').src = media('audio.png');

    var segs = $('#music-segs');
    (a.musicSegments || []).forEach(function (sg) {
      var len = sg[1] - sg[0];
      var row = el('div', 'musicseg');
      row.innerHTML = '<span class="musicseg__t">' + fmtTime(sg[0]) + '–' + fmtTime(sg[1]) + '</span>' +
        '<span class="musicseg__bar" style="width:' + Math.max(2, (len / DURATION) * 100) + '%"></span>';
      segs.appendChild(row);
    });
  }

  /* =====================================================================
     Packaging
     ===================================================================== */
  function renderPackaging() {
    var box = $('#stickers');
    var pack = DATA.packaging;
    (pack.stickers || []).forEach(function (st) {
      var e = el('div', 'sticker');
      if (st.image) {
        var im = el('img', 'sticker__img');
        im.src = media(st.image);
        im.alt = 'Sticker candidate ' + st.id;
        im.loading = 'lazy';
        e.appendChild(im);
      } else {
        e.classList.add('sticker--noimg');
        e.appendChild(el('div', 'sticker__ph', 'identified<br>by eye'));
      }
      var d = el('div');
      var h = el('div', 'entity__h');
      h.appendChild(el('span', 'entity__id', esc(st.id.replace(/^sticker_/, 'S'))));
      // Agent-found overlays carry a long prose kind_zh; lead with a short
      // label instead of dumping the whole sentence into the heading.
      var heading = st.source === 'agent'
        ? titleCase(st.kind || 'overlay')
        : (st.kindLabel || titleCase(st.kind));
      h.appendChild(el('span', 'entity__n', esc(heading)));
      d.appendChild(h);

      var body = st.description || (st.inPicture
        ? 'Not an overlay — part of the picture itself.'
        : 'Overlay detected by the tool.');
      d.appendChild(el('div', 'sticker__d', esc(body)));

      var m = el('div', 'sticker__m');
      if (st.t0 != null) m.appendChild(el('span', 'pill pill--ghost', fmtTime(st.t0) + '–' + fmtTime(st.t1)));
      if (st.where) m.appendChild(el('span', 'pill pill--ghost', esc(st.where)));
      if (st.source === 'agent') m.appendChild(el('span', 'pill pill--ok', 'agent confirmed'));
      else if (st.inPicture) m.appendChild(el('span', 'pill pill--warn', 'false positive'));
      if (st.persistentCuts) m.appendChild(el('span', 'pill pill--ghost', st.persistentCuts + ' cuts'));
      d.appendChild(m);
      e.appendChild(d);
      box.appendChild(e);
    });

    var note = $('#packaging-note');
    var missed = (pack.missed || []).map(function (m) {
      return typeof m === 'string' ? m : (m.what || m.description || JSON.stringify(m));
    });
    note.innerHTML = '<div class="note__t">What the detector missed</div>' +
      (missed.length
        ? '<ul style="margin:6px 0 0;padding-left:18px">' + missed.map(function (m) {
            return '<li>' + esc(m) + '</li>'; }).join('') + '</ul>'
        : 'No additional overlays were found by eye that the tool missed.');
  }

  /* =====================================================================
     Craft aspects
     ===================================================================== */
  function renderAspects() {
    var a = DATA.aspects;
    var box = $('#aspects');
    [
      ['Framing', a.framing || []],
      ['Camera', a.cameraLines || []],
      ['Lighting', a.lightingLines || []],
      ['Grade', a.gradeLines || []],
      ['Editing', a.editingLines || []]
    ].forEach(function (pair) {
      var e = el('div', 'aspect');
      e.appendChild(el('div', 'aspect__h', pair[0]));
      var b = el('div', 'aspect__b');
      if (pair[1].length) {
        pair[1].forEach(function (line) { b.appendChild(el('p', null, esc(line))); });
      } else {
        b.appendChild(el('p', null, '—'));
      }
      e.appendChild(b);
      box.appendChild(e);
    });

    var prose = [
      ['Camera', a.camera && a.camera.setups],
      ['Camera', a.camera && a.camera.gear_guess],
      ['Lighting', a.lighting && a.lighting.lighting_overall],
      ['Grade', a.grade && a.grade.grade_overall],
      ['Editing', a.editing && a.editing.editing]
    ].filter(function (p) { return p[1]; });

    prose.forEach(function (p) {
      var e = el('div', 'aspect');
      e.appendChild(el('div', 'aspect__h', p[0] + ' — in detail'));
      var b = el('div', 'aspect__b');
      b.appendChild(el('p', null, esc(p[1])));
      e.appendChild(b);
      box.appendChild(e);
    });
  }

  /* =====================================================================
     Shooting plan
     ===================================================================== */
  function renderPlan() {
    var box = $('#shoot-plan');
    (DATA.plan.shoot || []).forEach(function (s) {
      var e = el('div', 'plan');
      var h = el('div', 'plan__h');
      h.appendChild(el('span', 'plan__id', esc(s.id)));
      // The shooting plan has its own scene numbering, which does not line up
      // with the cast's scene ids — title it from its own description.
      var title = (s.description || '').split(':')[0];
      h.appendChild(el('span', 'plan__t', esc(title.length > 70 ? title.slice(0, 70) + '…' : title)));
      h.appendChild(el('span', 'plan__m', num(s.screenS, 1) + 's on screen · ' + s.shots.length + ' shots'));
      e.appendChild(h);

      var b = el('div', 'plan__b');
      if (s.description) b.appendChild(el('div', 'plan__desc', esc(s.description)));
      if (s.lighting) {
        b.appendChild(el('div', 'plan__sub', 'Lighting'));
        b.appendChild(el('div', 'plan__desc', esc(s.lighting)));
      }
      b.appendChild(el('div', 'plan__sub', 'Set-ups'));
      (s.setups || []).forEach(function (su) {
        var row = el('div', 'plan__setup');
        row.innerHTML =
          '<span>' + esc(titleCase(su.shotSize || '—')) + ' · ' + esc(su.support || '—') + '</span>' +
          '<span>' + esc((su.moves || []).map(titleCase).join(', ') || '—') + '</span>' +
          '<span class="plan__shots"></span>';
        // Shot numbers cross-link back into the explorer.
        var shotsSpan = row.querySelector('.plan__shots');
        (su.shots || []).forEach(function (n, i) {
          if (i) shotsSpan.appendChild(document.createTextNode(', '));
          var target = SHOTS.filter(function (sh) { return sh.n === n; })[0];
          if (!target) { shotsSpan.appendChild(document.createTextNode(String(n))); return; }
          var a = el('span', 'scene__shot', String(n));
          a.title = 'Shot ' + n + ' · ' + fmtTime(target.start) + ' · ' + words(target.description, 10);
          a.addEventListener('click', function () { focusShot(target.id); });
          shotsSpan.appendChild(a);
        });
        shotsSpan.appendChild(document.createTextNode(' · ' + num(su.takeS, 1) + 's take'));
        b.appendChild(row);
      });
      e.appendChild(b);
      box.appendChild(e);
    });

    var note = $('#remake-note');
    var plan = DATA.plan;
    var refs = DATA.verdict.references || {};
    var refList = Object.keys(refs).map(function (k) {
      return k + ' (' + refs[k].join(', ') + ')';
    });
    note.innerHTML = '<div class="note__t">Before you shoot</div>' +
      'This is a live-action trailer, so the remake is a shoot rather than a generation. ' +
      'The one thing you cannot supply on the day is the branding: ' +
      (refList.length ? esc(refList.join('; ')) : 'the venue logo and Bengali wordmark') +
      ' must be prepared as separate reference assets and composited onto the end cards. ' +
      'Target engine for any AI fallback is <code>' + esc(plan.modelName || plan.model || '—') +
      '</code>, but reaching for it should be the exception, not the plan.';
  }

  /* =====================================================================
     Open questions
     ===================================================================== */
  function renderOpen() {
    var box = $('#open-questions');
    var items = [];

    var ms = DATA.audio.musicSource;
    if (ms && ms.source_zh) {
      items.push({
        t: 'Is the music stock or AI-generated?',
        b: 'The signal cannot separate the two. The prior favours a stock library bed (' +
           pct((ms.probs || {}).existing_library) + '%) because the film is live footage, ' +
           'but an AI workflow can produce an identical result. ' +
           'The test is external: check the music tag on the original post, or run the track through a song-ID service.',
        w: 'Sound'
      });
    }

    items.push({
      t: 'Are the two low-confidence pops real sound effects?',
      b: 'Both were detected at 40.1s and 91.8s and both anchored to a sticker that turned out to be part of the picture. ' +
         'The anchor is wrong, so the effect is unconfirmed. Listen at those two points before assuming a sound design layer.',
      w: 'Sound'
    });

    items.push({
      t: 'Did the tool see any AI post-processing on the live footage?',
      b: 'The tool found no face swaps, lip-syncs, stylisation or background replacements. ' +
         'But it cannot rule out a graded or retouched original, and this file carries no AIGC metadata either way. ' +
         'Platform transcoding also tends to strip that metadata, so its absence is not evidence.',
      w: 'Production'
    });

    items.push({
      t: 'Is the final graphic card a template or custom artwork?',
      b: 'The two end cards are code-rendered: fixed layout, type set in the layout itself, an arched photo window. ' +
         'The tool identifies the method confidently but not whether the template came from a stock motion-graphics system ' +
         'or was built for this film.',
      w: 'Production'
    });

    items.push({
      t: 'Which camera and lens were used?',
      b: 'Inferred, not measured. Shallow depth of field and low-light capability point to a fast prime around 35–50mm ' +
         'equivalent on a high-ISO body, with a gimbal for the moving-camera feel. ' +
         'No EXIF survives in the file, so this is a working guess for the gear list.',
      w: 'Craft'
    });

    items.push({
      t: 'Was the trailer cut to the music or the music cut to the trailer?',
      b: 'Only 30% of cuts land on a detected beat, so the edit is not beat-locked. ' +
         'The music sits under the picture rather than driving it. Whether that is a deliberate ' +
         'non-sync choice or a loose fit is not recoverable from the file.',
      w: 'Editing'
    });

    items.forEach(function (it) {
      var e = el('div', 'card card--pad');
      var h = el('div', 'entity__h');
      h.appendChild(el('span', 'entity__n', esc(it.t)));
      e.appendChild(h);
      e.appendChild(el('div', 'entity__look', esc(it.b)));
      var m = el('div', 'shot__meta');
      m.style.marginTop = '9px';
      m.appendChild(el('span', 'pill pill--warn', esc(it.w)));
      e.appendChild(m);
      box.appendChild(e);
    });
  }

  /* =====================================================================
     Footer
     ===================================================================== */
  function renderFooter() {
    $('#foot-source').textContent = 'Source: ' + (DATA.source.filename || '') +
      ' · ' + (DATA.source.width + '×' + DATA.source.height) + ' · ' + num(DATA.source.duration, 2) + 's';
    var r = DATA.meta.review || {};
    $('#foot-review').textContent = 'Shot review: ' + (r.by || 'agent') + ' · ' +
      (r.shots || 0) + '/' + (r.of || 0) + ' shots · ' + (r.time || '');
  }

  /* =====================================================================
     Lightbox
     ===================================================================== */
  function initLightbox() {
    var lb = $('#lightbox');
    var img = $('#lb-img');
    var cap = $('#lb-cap');
    var queue = [];
    var idx = 0;

    function show(list, i) {
      queue = list; idx = i;
      var item = queue[idx];
      if (!item) return;
      img.src = item.src;
      img.alt = item.alt || 'Enlarged frame';
      cap.textContent = item.cap || '';
      lb.classList.add('is-open');
      document.body.style.overflow = 'hidden';
    }
    function close() {
      lb.classList.remove('is-open');
      document.body.style.overflow = '';
    }
    function step(d) {
      if (!queue.length) return;
      show(queue, (idx + d + queue.length) % queue.length);
    }

    document.addEventListener('click', function (e) {
      var t = e.target;
      if (t.classList && t.classList.contains('detail__media') === false &&
          (t.matches('.detail__media img') || t.matches('.detail__frames img'))) {
        var shots = Array.prototype.slice.call(document.querySelectorAll('.shot'));
        var list = [];
        var owner = t.closest('.shot');
        var sid = owner ? owner.dataset.shot : null;
        SHOTS.forEach(function (s) {
          if (s.sheet) {
            list.push({ src: media(s.sheet), alt: 'Shot ' + s.n + ' contact sheet',
                        cap: 'Shot ' + s.n + ' · ' + fmtTime(s.start) + '–' + fmtTime(s.end) +
                             ' · ' + s.labelName + ' · ' + words(s.description, 12) });
          }
        });
        var start = 0;
        SHOTS.forEach(function (s, i) { if (s.id === sid) start = i; });
        if (t.matches('.detail__frames img')) {
          var imgs = Array.prototype.slice.call(owner.querySelectorAll('.detail__frames img'));
          var sub = imgs.map(function (im) {
            return { src: im.src, alt: im.alt, cap: im.alt };
          });
          show(sub, Math.max(0, imgs.indexOf(t)));
          return;
        }
        show(list, start);
      }
      if (t.matches('.sticker__img')) {
        show([{ src: t.src, alt: t.alt, cap: 'Packaging candidate' }], 0);
      }
      if (t.id === 'hero-strip') {
        show([{ src: t.src, alt: t.alt,
                cap: 'Full contact sheet — all 58 shots in running order' }], 0);
      }
    });

    $('#lb-close').addEventListener('click', close);
    $('#lb-prev').addEventListener('click', function () { step(-1); });
    $('#lb-next').addEventListener('click', function () { step(1); });
    lb.addEventListener('click', function (e) {
      if (e.target === lb) close();
    });
    document.addEventListener('keydown', function (e) {
      if (!lb.classList.contains('is-open')) return;
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowLeft') step(-1);
      if (e.key === 'ArrowRight') step(1);
    });
  }

  /* =====================================================================
     Boot
     ===================================================================== */
  function init() {
    buildNav();
    initScrollSpy();
    initSearch();
    initLightbox();
    renderHero();
    renderTimeline();
    buildFilters();
    renderShots();
    renderCast();
    renderAudio();
    renderPackaging();
    renderAspects();
    renderPlan();
    renderOpen();
    renderFooter();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
