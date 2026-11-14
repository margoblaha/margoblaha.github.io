/*
 * Epistemic Margins
 * 1. Mycelium: a seeded hyphal network on the home page, and a small
 *    "culture plate" per essay, grown from the essay title so each
 *    piece always gets the same drawing.
 * 2. Sidenotes: footnotes are copied into the right-hand margin on
 *    wide screens. The footnote list at the end stays for everyone else.
 * 3. Nature: a landscape cross-section and margin drawings (About page).
 * 4. Contact page: links as small worlds joined by hyphae.
 *    Essays: a vine in the left margin that grows as you read.
 * 5. Copy link button on posts.
 */
(function () {
  "use strict";

  var SVGNS = "http://www.w3.org/2000/svg";
  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- seeded randomness ---------- */
  function hash(str) {
    var h = 1779033703 ^ str.length;
    for (var i = 0; i < str.length; i++) {
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    return h >>> 0;
  }
  function rng(seed) {
    var a = hash(seed);
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ---------- hyphal growth ----------
   * Each tip walks forward, wandering a little, and now and then
   * branches at an acute angle. Branches are thinner and shorter.
   */
  function grow(o) {
    var r = rng(o.seed);
    var tips = o.origins.map(function (s) {
      return { pts: [[s[0], s[1]]], a: s[2], depth: 0, born: 0, alive: true };
    });
    for (var t = 0; t < o.steps; t++) {
      var live = tips.filter(function (p) { return p.alive; });
      if (!live.length) break;
      for (var i = 0; i < live.length; i++) {
        var p = live[i];
        var last = p.pts[p.pts.length - 1];
        p.a += (r() - 0.5) * o.wander + (o.steer ? o.steer(last[0], last[1], p.a) : 0);
        var len = o.step * (1 - Math.min(p.depth, 4) * 0.1) * (0.8 + r() * 0.4);
        var nx = last[0] + Math.cos(p.a) * len;
        var ny = last[1] + Math.sin(p.a) * len;
        if (!o.inside(nx, ny)) { p.alive = false; continue; }
        p.pts.push([nx, ny]);
        if (p.pts.length > o.maxLen / (1 + p.depth * 0.55)) { p.alive = false; continue; }
        if (tips.length < o.maxTips && p.depth < o.maxDepth && p.pts.length > 3 && r() < o.branch) {
          var side = r() < 0.5 ? -1 : 1;
          tips.push({ pts: [[nx, ny]], a: p.a + side * (0.4 + r() * 0.65), depth: p.depth + 1, born: t + 1, alive: true });
        }
      }
    }
    return tips.filter(function (p) { return p.pts.length > 1; });
  }

  function pathD(pts) {
    var d = "M" + pts[0][0].toFixed(1) + " " + pts[0][1].toFixed(1);
    for (var i = 1; i < pts.length - 1; i++) {
      var mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2;
      d += "Q" + pts[i][0].toFixed(1) + " " + pts[i][1].toFixed(1) + " " + mx.toFixed(1) + " " + my.toFixed(1);
    }
    var l = pts[pts.length - 1];
    return d + "L" + l[0].toFixed(1) + " " + l[1].toFixed(1);
  }

  function el(name, attrs) {
    var n = document.createElementNS(SVGNS, name);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    return n;
  }

  /* draw hyphae into an svg; returns timing info for each tip */
  function drawHyphae(svg, tips, opt) {
    var g = el("g", { "class": "hyphae", fill: "none", "stroke-linecap": "round", "stroke-linejoin": "round" });
    tips.forEach(function (p) {
      var w = Math.max(opt.minWidth, opt.width / (1 + p.depth * 0.9));
      var path = el("path", {
        d: pathD(p.pts),
        "stroke-width": w.toFixed(2),
        "class": "hypha hypha--d" + Math.min(p.depth, 3),
        pathLength: "1"
      });
      if (opt.animate) {
        var delay = p.born * opt.stepMs, dur = (p.pts.length - 1) * opt.stepMs;
        path.style.animation = "em-grow " + dur + "ms linear " + delay + "ms both";
        p.doneAt = delay + dur;
      }
      g.appendChild(path);
    });
    svg.appendChild(g);
    // a few spore-like tips
    var tg = el("g", { "class": "tips" });
    tips.forEach(function (p, i) {
      if (p.depth === 0 || i % opt.tipEvery) return;
      var l = p.pts[p.pts.length - 1];
      var c = el("circle", { cx: l[0].toFixed(1), cy: l[1].toFixed(1), r: opt.tipR, "class": "tip" });
      if (opt.animate) c.style.animation = "em-pop 600ms ease-out " + p.doneAt + "ms both";
      tg.appendChild(c);
    });
    svg.appendChild(tg);
  }

  /* ---------- home page network ---------- */
  function heroNet(box, animate) {
    var w = box.clientWidth, h = box.clientHeight;
    if (!w || !h) return;
    var old = box.querySelector("svg");
    if (old) old.remove();
    var small = w < 720;
    var svg = el("svg", { viewBox: "0 0 " + w + " " + h, width: w, height: h, "class": "hero__svg", focusable: "false", "aria-hidden": "true" });
    box.insertBefore(svg, box.firstChild);

    var tips = grow({
      seed: box.getAttribute("data-seed") || "margins",
      origins: [
        [w * 0.04, h * 1.0, -0.7],
        [w * 0.3, h * 0.98, -0.5],
        [-10, h * 0.5, -0.2]
      ],
      step: small ? 9 : 13,
      steps: 150,
      wander: 0.5,
      branch: small ? 0.07 : 0.09,
      maxTips: small ? 55 : 105,
      maxDepth: 4,
      maxLen: small ? 70 : 100,
      steer: function (x, y, a) {
        // drift right and slightly up, like growth towards fresh substrate
        var target = -0.35 + (y / h - 0.5) * -0.4;
        return (target - a) * 0.025;
      },
      inside: function (x, y) { return x > -20 && y > -20 && x < w + 20 && y < h + 20; }
    });

    drawHyphae(svg, tips, { width: small ? 1.6 : 2.2, minWidth: 0.6, animate: animate, stepMs: 22, tipEvery: 3, tipR: 1.8 });

    // words sit on far-reaching branch ends. Each word's whole box must be
    // clear of the title, the introduction and every word already placed.
    var labels = Array.prototype.slice.call(box.querySelectorAll(".hero__topic"));
    if (!labels.length) return;
    if (small) {                       // phones: the words become a plain list (see CSS)
      labels.forEach(function (n) { n.style.left = ""; n.style.top = ""; n.style.animation = "none"; n.parentNode.hidden = false; });
      return;
    }
    labels.forEach(function (n) { n.parentNode.hidden = false; n.style.left = "0px"; n.style.top = "0px"; });
    var widths = labels.map(function (n) { return n.offsetWidth; });
    var rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    var off = 1.1 * rem;               // the word starts this far right of its node
    var origin = box.getBoundingClientRect();
    var avoid = [];
    Array.prototype.forEach.call(document.querySelectorAll(".hero__word, .hero__lede p"), function (n) {
      var range = document.createRange();
      range.selectNodeContents(n);
      var b = range.getBoundingClientRect();
      avoid.push([b.left - origin.left - 20, b.top - origin.top - 20, b.right - origin.left + 20, b.bottom - origin.top + 20]);
    });
    var hit = function (a, b) { return !(a[2] < b[0] || a[0] > b[2] || a[3] < b[1] || a[1] > b[3]); };
    var tipOf = function (p) { return p.pts[p.pts.length - 1]; };
    var cands = tips.filter(function (p) {
      var l = tipOf(p);
      return p.depth <= 2 && p.pts.length > 8 && l[0] > w * 0.3 && l[1] > h * 0.12 && l[1] < h * 0.84;
    });
    var placed = [], rects = [];
    var ng = el("g", { "class": "nodes" });
    labels.forEach(function (n, i) {
      var best = null, bestS = -Infinity;
      cands.forEach(function (c) {
        if (placed.indexOf(c) > -1) return;
        var l = tipOf(c);
        var r = [l[0] - 14, l[1] - 20, l[0] + off + widths[i] + 14, l[1] + 20];
        if (r[2] > w - 24) return;
        if (avoid.some(function (a) { return hit(r, a); })) return;
        if (rects.some(function (q) { return hit(r, q); })) return;
        var score;
        if (!placed.length) score = -Math.hypot(l[0] - w * 0.8, l[1] - h * 0.3);
        else {
          score = Infinity;
          placed.forEach(function (q) { var m = tipOf(q); score = Math.min(score, Math.hypot(l[0] - m[0], (l[1] - m[1]) * 1.6)); });
        }
        if (score > bestS) { bestS = score; best = c; }
      });
      if (!best) { n.parentNode.hidden = true; return; }
      var l = tipOf(best);
      placed.push(best);
      rects.push([l[0] - 14, l[1] - 20, l[0] + off + widths[i] + 14, l[1] + 20]);
      var seed = n.classList.contains("hero__topic--seed");
      var dot = el("circle", { cx: l[0].toFixed(1), cy: l[1].toFixed(1), r: seed ? 3.5 : 4, "class": "node" + (seed ? " node--seed" : "") });
      var halo = el("circle", { cx: l[0].toFixed(1), cy: l[1].toFixed(1), r: 10, "class": "node-halo" + (seed ? " node-halo--seed" : "") });
      n.style.left = l[0] + "px";
      n.style.top = l[1] + "px";
      if (animate) {
        var t = (best.doneAt || 0) + 120;
        dot.style.animation = "em-pop 700ms ease-out " + t + "ms both";
        halo.style.animation = "em-pop 900ms ease-out " + t + "ms both";
        n.style.animation = "em-label 900ms ease-out " + (t + 150) + "ms both";
      } else {
        n.style.animation = "none";
      }
      ng.appendChild(halo);
      ng.appendChild(dot);
    });
    svg.appendChild(ng);
  }

  /* ---------- culture plates ---------- */
  function plate(node) {
    if (node.querySelector("svg")) return;
    var S = 200, c = S / 2, R = 88;
    var seed = node.getAttribute("data-seed") || "plate";
    var r = rng(seed + "#plate");
    var svg = el("svg", { viewBox: "0 0 " + S + " " + S, "class": "plate__svg", focusable: "false" });
    svg.appendChild(el("circle", { cx: c, cy: c, r: R + 6, "class": "plate__rim" }));
    svg.appendChild(el("circle", { cx: c, cy: c, r: R, "class": "plate__agar" }));
    var n = 4 + Math.floor(r() * 4);
    var turn = r() * Math.PI * 2;
    // colony may start a little off-centre, as a real inoculation would
    var ox = c + (r() - 0.5) * 30, oy = c + (r() - 0.5) * 30;
    var origins = [];
    for (var i = 0; i < n; i++) origins.push([ox, oy, turn + (i / n) * Math.PI * 2 + (r() - 0.5) * 0.4]);
    var tips = grow({
      seed: seed,
      origins: origins,
      step: 6.5,
      steps: 60,
      wander: 0.55,
      branch: 0.12,
      maxTips: 90,
      maxDepth: 4,
      maxLen: 26,
      steer: function (x, y, a) {
        // keep growing outward from the inoculation point
        var out = Math.atan2(y - oy, x - ox);
        var d = Math.atan2(Math.sin(out - a), Math.cos(out - a));
        return d * 0.06;
      },
      inside: function (x, y) { var dx = x - c, dy = y - c; return dx * dx + dy * dy < (R - 4) * (R - 4); }
    });
    drawHyphae(svg, tips, { width: 2.6, minWidth: 0.8, animate: false, tipEvery: 2, tipR: 2.2 });
    svg.appendChild(el("circle", { cx: ox.toFixed(1), cy: oy.toFixed(1), r: 4.5, "class": "plate__core" }));
    node.appendChild(svg);
  }

  /* ---------- marginalia: small drawings beside section headings ----------
   * Add to a page's front matter, one name per "## heading", in order:
   *   marginalia: [mushroom, sun, rain, mountains, birds]
   * Available: mushroom, sun, rain, cloud, mountains, fern, tree, birds, mosquito.
   * Use "none" to leave a heading with its plain terracotta mark.
   */
  var ART = {
    mushroom: function () {
      return '<path class="m-warm" d="M8 33C9 17 55 17 56 33C47 36.5 17 36.5 8 33Z"/>' +
        '<path class="m-thin" d="M15 34.2l2.5 1.6M22.5 35l1.3 1.4M30.5 35.3v1.5M38.5 35.2l-1 1.4M46 34.4l-2.4 1.5"/>' +
        '<path d="M26 35.8C25.2 44 24.2 51 22 57h20c-2.2-6-3.2-13-4-21.2"/>' +
        '<circle cx="21.5" cy="25.5" r="2"/><circle cx="34.5" cy="21.8" r="1.6"/><circle cx="45" cy="27.2" r="1.8"/>' +
        '<path class="m-thin" d="M22 57c-6 1-10 4-16 3M42 57c6 1 9 4 16 2M32 57c-1 3 1 5-1 7"/>';
    },
    sun: function () {
      var s = '<circle class="m-warm" cx="32" cy="32" r="10"/>';
      for (var i = 0; i < 12; i++) {
        var a = i * Math.PI / 6, r1 = 15.5, r2 = i % 2 ? 19.5 : 23.5;
        s += '<path d="M' + (32 + Math.cos(a) * r1).toFixed(1) + ' ' + (32 + Math.sin(a) * r1).toFixed(1) +
             'L' + (32 + Math.cos(a) * r2).toFixed(1) + ' ' + (32 + Math.sin(a) * r2).toFixed(1) + '"/>';
      }
      return s;
    },
    cloud: function () {
      return '<path d="M13 40c-7 0-8-10-0.5-11C12 20 24 17 28.5 23.5 31.5 14 47 15 47 25c7.5-1 10.5 9.5 3.5 15Z"/>' +
        '<path class="m-thin" d="M20 34c3-2 6-2 9 0"/>';
    },
    rain: function () {
      return '<path d="M13 34c-7 0-8-10-0.5-11C12 14 24 11 28.5 17.5 31.5 8 47 9 47 19c7.5-1 10.5 9.5 3.5 15Z"/>' +
        '<path class="m-warm-line" d="M18 40l-3 7M27 40l-3.6 9M36 40l-3 7M45 39.5l-3.6 9M21.5 52l-1.4 3.4M39.4 52l-1.4 3.4M30 56l-1 2.6"/>';
    },
    mountains: function () {
      return '<path d="M3 54L22 20l9 13 9-11 21 32"/>' +
        '<path class="m-thin" d="M17 29l2.5-1.5L22 30l2.5-2.6L26.8 27M35.9 27l2.1-1.2 2 2 2-1.8 1.3 1"/>' +
        '<path class="m-warm-line" d="M1 54h62"/>' +
        '<path class="m-thin" d="M9 54l2.5-6 2.5 6M50 54l2.5-7 2.5 7M55 54l2-5 2 5"/>';
    },
    fern: function () {
      var s = '<path d="M30 62C31 46 33 30 44 8"/>';
      for (var i = 1; i < 9; i++) {
        var t = i / 9, u = 1 - t;
        var x = u*u*u*30 + 3*u*u*t*31 + 3*u*t*t*33 + t*t*t*44;
        var y = u*u*u*62 + 3*u*u*t*46 + 3*u*t*t*30 + t*t*t*8;
        var L = 13 * (1 - t) + 3;
        s += '<path class="m-thin" d="M' + x.toFixed(1) + ' ' + y.toFixed(1) + 'q' + (-L * 0.6).toFixed(1) + ' ' + (-L * 0.15).toFixed(1) + ' ' + (-L).toFixed(1) + ' ' + (-L * 0.55).toFixed(1) +
             'M' + x.toFixed(1) + ' ' + y.toFixed(1) + 'q' + (L * 0.55).toFixed(1) + ' ' + (-L * 0.45).toFixed(1) + ' ' + (L * 0.8).toFixed(1) + ' ' + (-L * 1.05).toFixed(1) + '"/>';
      }
      return s;
    },
    tree: function () {
      return '<path d="M32 6L21 24h6L15 41h9L11 56h42L40 41h9L37 24h6Z"/><path class="m-warm-line" d="M30 56v6h4v-6"/>';
    },
    birds: function () {
      return '<path d="M5 34q8-11 15.5-2q7-10 16.5-3"/><path class="m-thin" d="M38 19q4-5.5 8-1.5q4-5 9.5-1.5"/>' +
        '<path class="m-thin" d="M26 48q3-4 6-0.8q3-3.8 7-0.8"/>';
    },
    mosquito: function () {
      // Aedes albopictus, the tiger mosquito: banded legs
      return '<circle cx="16" cy="29" r="3"/><path d="M13.6 30.4L4 36M15 26.5l-5-6.5"/>' +
        '<ellipse cx="23.5" cy="30.5" rx="5.5" ry="4.3"/>' +
        '<path d="M28.5 31.5c7 2 17 6 27 13.5-8.5-.6-18.5-4.8-27-9.5z"/>' +
        '<path class="m-thin" d="M24 26.5c5-9 17-14 26-12-8 3.5-16 8.5-24 13"/>' +
        '<path class="m-band" d="M21.5 34.5L15.5 44 8 57M24 35v11l-3.5 15M26 34.5l7.5 11L40 60"/>';
    }
  };

  function marginalia() {
    var body = document.querySelector(".sheet__body[data-marginalia]");
    if (!body) return;
    var names = body.getAttribute("data-marginalia").split(/[\s,]+/);
    var heads = body.querySelectorAll(":scope > h2");
    Array.prototype.forEach.call(heads, function (h, i) {
      var draw = ART[names[i]];
      if (!draw) return;
      var span = document.createElement("span");
      span.className = "marginalia";
      span.setAttribute("aria-hidden", "true");
      span.innerHTML = '<svg viewBox="0 0 64 64" focusable="false">' + draw() + "</svg>";
      h.classList.add("has-marginalia");
      h.insertBefore(span, h.firstChild);
    });
  }

  /* ---------- the about-page landscape ----------
   * Sky, Alpine ridges, forest; below the ground line, roots and the
   * mycelium that links them, surfacing here and there as mushrooms.
   */
  // a mountain range: overlapping steep peaks with a little rock texture.
  // Peaks on the left are kept lower so the page title has clear sky.
  function ridge(r, w, base, amp, peaks, slope, jag) {
    var ps = [];
    for (var i = 0; i < peaks; i++) {
      var px = -20 + (w + 40) * (i + 0.15 + r() * 0.7) / peaks;
      var calm = Math.min(1, Math.max(0, px / (w * 0.42)));
      var sl = slope * (0.55 + r() * 0.9), sr2 = slope * (0.55 + r() * 0.9);
      ps.push({ x: px, h: amp * (0.45 + r() * 0.55) * (0.5 + 0.5 * calm), l: sl, r: sr2 });
    }
    var pts = [], j = 0;
    for (var x = -20; x <= w + 20; x += 5) {
      var top = 0;
      ps.forEach(function (p) { top = Math.max(top, p.h - (x < p.x ? p.l : p.r) * Math.abs(x - p.x)); });
      j = j * 0.6 + (r() - 0.5) * jag;
      pts.push([x, base - Math.max(0, top) - j * Math.min(1, top / (amp * 0.3))]);
    }
    return pts;
  }
  function line(pts) { return pts.map(function (p, i) { return (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1); }).join(""); }

  function scene(box, animate) {
    var w = box.clientWidth, h = box.clientHeight;
    if (!w || !h) return;
    var old = box.querySelector("svg");
    if (old) old.remove();
    var r = rng((box.getAttribute("data-seed") || "scene") + "#scene");
    var small = w < 720;
    var gy = Math.round(h * 0.64);                       // ground line
    var svg = el("svg", { viewBox: "0 0 " + w + " " + h, width: w, height: h, "class": "scene__svg", focusable: "false" });
    box.appendChild(svg);
    var add = function (name, attrs, parent) { var n = el(name, attrs); (parent || svg).appendChild(n); return n; };

    // sun, with heat rings
    var sx = w * (small ? 0.78 : 0.8), sy = h * 0.24, sr = small ? 16 : 24;
    [3.4, 2.5, 1.75].forEach(function (k, i) { add("circle", { cx: sx, cy: sy, r: sr * k, "class": "sc-ring sc-ring--" + i }); });
    add("circle", { cx: sx, cy: sy, r: sr, "class": "sc-sun" });

    // three ranges, far to near
    var sky = gy;                                         // height of the sky band
    var ranges = [
      { base: gy - sky * 0.1, amp: sky * 0.66, peaks: small ? 4 : 7, slope: 1.15, jag: 9, cls: "far", snow: gy - sky * 0.1 - sky * 0.36 },
      { base: gy - sky * 0.02, amp: sky * 0.4, peaks: small ? 5 : 9, slope: 0.9, jag: 6, cls: "mid", snow: gy - sky * 0.02 - sky * 0.3 },
      { base: gy + 2, amp: sky * 0.13, peaks: small ? 4 : 8, slope: 0.35, jag: 2, cls: "near" }
    ];
    var drawn = ranges.map(function (g) {
      var pts = ridge(r, w, g.base, g.amp, g.peaks, g.slope, g.jag);
      var group = el("g", { "class": "sc-range sc-range--" + g.cls });
      add("path", { d: line(pts) + "L" + (w + 20) + " " + (gy + 4) + "L-20 " + (gy + 4) + "Z", "class": "sc-rock" }, group);
      add("path", { d: line(pts), "class": "sc-ridge" }, group);
      if (g.snow) {
        var snow = "", on = false;
        pts.forEach(function (p) {
          if (p[1] < g.snow) { snow += (on ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1); on = true; } else on = false;
        });
        if (snow) add("path", { d: snow, "class": "sc-snow" }, group);
      }
      return group;
    });

    svg.appendChild(drawn[0]);

    // clouds, kept to the right of the page title; one of them is raining
    var clouds = [], cn = small ? 2 : 3;
    for (var c = 0; c < cn; c++) {
      var cw = (small ? 60 : 90) + r() * (small ? 40 : 80);
      var cx = w * (0.36 + 0.5 * (c + r() * 0.5) / cn);
      if (cx + cw > sx - sr * 3.6 && cx < sx + sr * 3.6) cx = sx - sr * 3.8 - cw - r() * 20;
      var cy = h * (0.16 + r() * 0.2);
      var bumps = 3 + Math.floor(r() * 2), x = cx, d = "M" + cx.toFixed(1) + " " + cy.toFixed(1);
      var weights = [], tot = 0;
      for (var b = 0; b < bumps; b++) { var wt = 0.7 + r() * 0.5 + (b > 0 && b < bumps - 1 ? 0.6 : 0); weights.push(wt); tot += wt; }
      for (b = 0; b < bumps; b++) {
        var bw = cw * weights[b] / tot, rad = bw / 2;
        x += bw;
        d += "A" + rad.toFixed(1) + " " + rad.toFixed(1) + " 0 0 1 " + x.toFixed(1) + " " + cy.toFixed(1);
      }
      clouds.push({ d: d + "Z", x: cx, y: cy, w: cw });
    }
    var rainy = clouds[clouds.length > 1 ? 1 : 0];
    var rain = el("g", { "class": "sc-rain" });
    for (var rx = rainy.x + 8; rx < rainy.x + rainy.w - 6; rx += 7 + r() * 4) {
      var y0 = rainy.y + 4 + r() * 6, len = (gy - rainy.y) * (0.55 + r() * 0.35);
      add("path", { d: "M" + rx.toFixed(1) + " " + y0.toFixed(1) + "l" + (-len * 0.18).toFixed(1) + " " + len.toFixed(1) }, rain);
    }
    svg.appendChild(rain);
    clouds.forEach(function (cl) { add("path", { d: cl.d, "class": "sc-cloud" }); });

    svg.appendChild(drawn[1]);
    svg.appendChild(drawn[2]);

    // a few birds
    for (var k = 0; k < (small ? 2 : 4); k++) {
      var bx = w * (0.42 + r() * 0.3), by = h * (0.08 + r() * 0.22), s = 4 + r() * 4;
      add("path", { d: "M" + bx.toFixed(1) + " " + by.toFixed(1) + "q" + s + " " + (-s) + " " + (s * 1.8) + " " + (-s * 0.1) + "q" + (s * 0.9) + " " + (-s * 1.05) + " " + (s * 2) + " " + (-s * 0.4), "class": "sc-bird" });
    }

    // soil
    add("rect", { x: -20, y: gy, width: w + 40, height: h - gy + 20, "class": "sc-soil" });

    // forest along the ground line, in loose clusters
    var trees = [], tx = 6;
    while (tx < w - 6) {
      var dense = 0.5 + 0.5 * Math.sin(tx / w * 9 + r() * 0.6);
      if (r() < 0.25 + dense * 0.7) {
        var th = (small ? 20 : 30) + r() * (small ? 26 : 44) * (0.6 + dense * 0.5);
        trees.push({ x: tx, h: th, kind: r() < 0.72 ? "conifer" : "broad" });
      }
      tx += (small ? 9 : 12) + r() * 18;
    }

    // roots and mycelium: drawn first so the trees sit on top
    var underground = el("g", { "class": "sc-under" });
    svg.appendChild(underground);
    var rootOrigins = [];
    trees.forEach(function (t) {
      var n = 2 + Math.floor(r() * 2);
      for (var q = 0; q < n; q++) rootOrigins.push([t.x, gy + 1, Math.PI / 2 + (r() - 0.5) * 1.6]);
    });
    var roots = grow({
      seed: "roots" + w, origins: rootOrigins, step: 3.2, steps: 9, wander: 0.5, branch: 0.12,
      maxTips: rootOrigins.length * 2, maxDepth: 1, maxLen: 8,
      inside: function (x, y) { return y > gy && y < h - 4; }
    });
    roots.forEach(function (p) { add("path", { d: pathD(p.pts), "class": "sc-root", "stroke-width": p.depth ? 0.8 : 1.3 }, underground); });

    var myOrigins = [];
    roots.forEach(function (p, i) {
      if (p.depth || i % 5) return;
      var l = p.pts[p.pts.length - 1];
      myOrigins.push([l[0], l[1], r() < 0.5 ? (r() - 0.5) * 0.6 : Math.PI + (r() - 0.5) * 0.6]);
    });
    var soilMid = gy + (h - gy) * 0.45;
    var hyphae = grow({
      seed: "mycelium" + w, origins: myOrigins, step: small ? 7 : 9, steps: 60, wander: 0.32, branch: 0.05,
      maxTips: small ? 34 : 70, maxDepth: 3, maxLen: 34,
      steer: function (x, y, a) { return (soilMid - y) * 0.004 * Math.cos(a); },
      inside: function (x, y) { return y > gy + 5 && y < h - 6 && x > -10 && x < w + 10; }
    });
    var myc = el("g", { "class": "sc-mycelium" });
    underground.appendChild(myc);
    drawHyphae(myc, hyphae, { width: 1.3, minWidth: 0.5, animate: animate, stepMs: 26, tipEvery: 4, tipR: 1.4 });

    // trees
    var forest = el("g", { "class": "sc-forest" });
    svg.appendChild(forest);
    trees.forEach(function (t) {
      var x = t.x, y = gy, H = t.h, W = H * 0.42;
      if (t.kind === "conifer") {
        var d2 = "M" + x.toFixed(1) + " " + (y - H).toFixed(1);
        var tiers = 3;
        for (var ti = 1; ti <= tiers; ti++) {
          var ty = y - H + H * 0.86 * ti / tiers, tw = W * ti / tiers;
          d2 += "L" + (x + tw).toFixed(1) + " " + ty.toFixed(1) + (ti < tiers ? "L" + (x + tw * 0.45).toFixed(1) + " " + ty.toFixed(1) : "");
        }
        for (ti = tiers; ti >= 1; ti--) {
          var ty2 = y - H + H * 0.86 * ti / tiers, tw2 = W * ti / tiers;
          d2 += (ti < tiers ? "L" + (x - tw2 * 0.45).toFixed(1) + " " + ty2.toFixed(1) : "") + "L" + (x - tw2).toFixed(1) + " " + ty2.toFixed(1);
        }
        add("path", { d: d2 + "Z", "class": "sc-tree" }, forest);
        add("path", { d: "M" + x.toFixed(1) + " " + (y - H * 0.14).toFixed(1) + "V" + y, "class": "sc-trunk" }, forest);
      } else {
        var cr = H * 0.3;
        add("path", { d: "M" + x.toFixed(1) + " " + y + "V" + (y - H * 0.55).toFixed(1), "class": "sc-trunk" }, forest);
        add("ellipse", { cx: x.toFixed(1), cy: (y - H + cr).toFixed(1), rx: (cr * 1.05).toFixed(1), ry: cr.toFixed(1), "class": "sc-tree" }, forest);
      }
    });

    // where the network surfaces: mushrooms between the trees
    var spots = hyphae.filter(function (p, i) { return i % 5 === 0 && p.pts.length > 6; }).slice(0, small ? 4 : 8);
    spots.forEach(function (p) {
      var mx = p.pts[Math.floor(p.pts.length / 2)][0], m = small ? 3.2 : 4 + r() * 2.5;
      var g = el("g", { "class": "sc-mushroom" });
      add("path", { d: "M" + mx.toFixed(1) + " " + gy + "v" + (-m * 1.3).toFixed(1), "class": "sc-stem" }, g);
      add("path", { d: "M" + (mx - m).toFixed(1) + " " + (gy - m * 1.2).toFixed(1) + "a" + m.toFixed(1) + " " + (m * 0.85).toFixed(1) + " 0 0 1 " + (m * 2).toFixed(1) + " 0Z", "class": "sc-cap" }, g);
      if (animate) g.style.animation = "em-pop 700ms ease-out " + (1400 + r() * 1400).toFixed(0) + "ms both";
      svg.appendChild(g);
    });

    // ferns and grass at the edge of the forest
    for (var f = 0; f < (small ? 10 : 22); f++) {
      var fx = r() * w, fh = 4 + r() * 6;
      add("path", { d: "M" + fx.toFixed(1) + " " + gy + "q" + (-fh * 0.3).toFixed(1) + " " + (-fh * 0.6).toFixed(1) + " " + (-fh * 0.8).toFixed(1) + " " + (-fh).toFixed(1) +
        "M" + fx.toFixed(1) + " " + gy + "q" + (fh * 0.1).toFixed(1) + " " + (-fh * 0.7).toFixed(1) + " " + (fh * 0.6).toFixed(1) + " " + (-fh * 1.1).toFixed(1), "class": "sc-grass" });
    }

    add("path", { d: "M-20 " + gy + "H" + (w + 20), "class": "sc-ground" });
  }

  /* ---------- contact page: small worlds joined by hyphae ----------
   * Each link is a world. Hyphae grow out from the hub (email) along a
   * spanning tree, then slow pulses travel along them like signals.
   */
  function seekPath(r, a, b, step) {
    var pts = [[a[0], a[1]]], x = a[0], y = a[1];
    var ang = Math.atan2(b[1] - y, b[0] - x) + (r() - 0.5) * 1.2;
    for (var i = 0; i < 600; i++) {
      var want = Math.atan2(b[1] - y, b[0] - x);
      var diff = Math.atan2(Math.sin(want - ang), Math.cos(want - ang));
      var d = Math.hypot(b[0] - x, b[1] - y);
      var near = Math.min(1, 90 / d);                 // home in harder near the end
      ang += diff * (0.14 + near * 0.6) + (r() - 0.5) * 0.5 * (1 - near * 0.8);
      x += Math.cos(ang) * step; y += Math.sin(ang) * step;
      pts.push([x, y]);
      if (Math.hypot(b[0] - x, b[1] - y) < Math.max(step * 1.6, 16)) { pts.push([b[0], b[1]]); break; }
    }
    return pts;
  }
  function pathLen(pts) {
    var L = 0;
    for (var i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    return L;
  }

  function connect(box, animate) {
    var w = box.clientWidth, h = box.clientHeight;
    if (!w || !h) return;
    var old = box.querySelector(".connect__svg");
    if (old) old.remove();
    var small = w < 720;
    var r = rng("worlds" + Math.round(w / 50));
    var links = Array.prototype.slice.call(box.querySelectorAll(".world"));
    if (!links.length) return;

    // keep worlds clear of the page text
    var origin = box.getBoundingClientRect();
    var avoid = [];
    Array.prototype.forEach.call(document.querySelectorAll(".sheet--connect .sheet__titles, .sheet--connect .sheet__body > *"), function (n) {
      var b = n.getBoundingClientRect();
      if (!b.width) return;
      avoid.push([b.left - origin.left - 40, b.top - origin.top - 40, b.right - origin.left + 40, b.bottom - origin.top + 70]);
    });
    var pad = small ? 60 : 130;
    var free = function (x, y) {
      if (x < pad || x > w - pad || y < pad + 20 || y > h - pad) return false;
      return avoid.every(function (a) { return x < a[0] - 60 || x > a[2] + 60 || y < a[1] - 50 || y > a[3] + 30; });
    };
    var cands = [];
    for (var c = 0; c < 2500 && cands.length < 600; c++) {
      var cx = r() * w, cy = r() * h;
      if (free(cx, cy)) cands.push([cx, cy]);
    }
    if (cands.length < links.length) { box.classList.remove("connect--live"); return; }

    // hub near the middle of the free area, then spread the rest out
    var mx = 0, my = 0;
    cands.forEach(function (p) { mx += p[0]; my += p[1]; });
    mx /= cands.length; my /= cands.length;
    var hubIndex = Math.max(0, links.findIndex(function (a) { return a.classList.contains("world--hub"); }));
    var order = [hubIndex].concat(links.map(function (_, i) { return i; }).filter(function (i) { return i !== hubIndex; }));
    var pos = new Array(links.length);
    pos[hubIndex] = cands.reduce(function (best, p) {
      return Math.hypot(p[0] - mx, p[1] - my) < Math.hypot(best[0] - mx, best[1] - my) ? p : best;
    });
    // spread out, but only up to a comfortable spacing; beyond that, stay close to the hub
    var hubP = pos[hubIndex], spacing = small ? 140 : Math.min(330, w / 4.2);
    var placed = [hubP];
    order.slice(1).forEach(function (i) {
      var best = null, bestS = -Infinity;
      cands.forEach(function (p) {
        var d = Infinity;
        placed.forEach(function (q) { d = Math.min(d, Math.hypot(p[0] - q[0], (p[1] - q[1]) * 1.2)); });
        var score = Math.min(d, spacing) * 3 - Math.hypot(p[0] - hubP[0], p[1] - hubP[1]) * 0.35;
        if (score > bestS) { bestS = score; best = p; }
      });
      pos[i] = best; placed.push(best);
    });

    // spanning tree from the hub (Prim), plus a few short extra links
    var n = links.length, inTree = [hubIndex], edges = [], depth = {}; depth[hubIndex] = 0;
    var dist = function (i, j) { return Math.hypot(pos[i][0] - pos[j][0], pos[i][1] - pos[j][1]); };
    while (inTree.length < n) {
      var bi = -1, bj = -1, bd = Infinity;
      inTree.forEach(function (i) {
        for (var j = 0; j < n; j++) if (inTree.indexOf(j) < 0 && dist(i, j) < bd) { bd = dist(i, j); bi = i; bj = j; }
      });
      edges.push([bi, bj, false]); inTree.push(bj); depth[bj] = depth[bi] + 1;
    }
    for (var i2 = 0; i2 < n; i2++) {
      var near = -1, nd = Infinity;
      for (var j2 = 0; j2 < n; j2++) {
        if (j2 === i2) continue;
        var dup = edges.some(function (e) { return (e[0] === i2 && e[1] === j2) || (e[0] === j2 && e[1] === i2); });
        if (!dup && dist(i2, j2) < nd) { nd = dist(i2, j2); near = j2; }
      }
      if (near > -1 && r() < 0.5) edges.push([Math.min(i2, near), Math.max(i2, near), true]);
    }

    var svg = el("svg", { viewBox: "0 0 " + w + " " + h, width: w, height: h, "class": "connect__svg", focusable: "false", "aria-hidden": "true" });
    box.insertBefore(svg, box.firstChild);

    // faint ambient growth across the whole page
    var amb = grow({
      seed: "ambient" + Math.round(w / 50),
      origins: [[-10, h * 0.85, -0.35], [w * 0.5, h + 10, -1.5], [w + 10, h * 0.3, Math.PI + 0.3], [w * 0.2, -10, 1.2]],
      step: 11, steps: 120, wander: 0.45, branch: 0.06, maxTips: small ? 30 : 60, maxDepth: 3, maxLen: 70,
      inside: function (x, y) { return x > -20 && y > -20 && x < w + 20 && y < h + 20; }
    });
    var ambG = el("g", { "class": "connect__ambient" });
    svg.appendChild(ambG);
    drawHyphae(ambG, amb, { width: 1.3, minWidth: 0.5, animate: animate, stepMs: 30, tipEvery: 5, tipR: 1.3 });

    // the links between worlds, with short side branches
    var speed = 0.45;                                  // px per ms while growing
    var reached = {}; reached[hubIndex] = 0;
    var edgeG = el("g", { "class": "connect__edges" }), sideG = el("g", { "class": "connect__sides" });
    svg.appendChild(sideG); svg.appendChild(edgeG);
    // grow tree edges in order of depth so each starts where the last arrived
    var sorted = edges.slice().sort(function (a, b) { return (a[2] - b[2]) || (depth[a[0]] - depth[b[0]]); });
    var finish = 0, paths = [];
    sorted.forEach(function (e, k) {
      var from = e[0], to = e[1];
      if (!e[2] && depth[to] < depth[from]) { var t = from; from = to; to = t; }
      var pts = seekPath(r, pos[from], pos[to], small ? 7 : 9);
      var L = pathLen(pts);
      var start = e[2] ? Math.max(reached[from] || 0, reached[to] || 0) + 200 : (reached[from] || 0);
      var dur = L / speed;
      if (!e[2]) reached[to] = start + dur;
      finish = Math.max(finish, start + dur);
      var id = "em-link-" + k;
      var p = el("path", { d: pathD(pts), id: id, pathLength: "1", "class": "link" + (e[2] ? " link--extra" : ""), "data-a": from, "data-b": to });
      if (animate) p.style.animation = "em-grow " + dur.toFixed(0) + "ms ease-in-out " + start.toFixed(0) + "ms both";
      edgeG.appendChild(p);
      paths.push({ el: p, id: id, len: L, a: from, b: to, start: start + dur });
      // side branches sprouting off the link
      var origins = [];
      for (var s = 6; s < pts.length - 6; s += 9 + Math.floor(r() * 8)) {
        var q0 = pts[s - 1], q1 = pts[s];
        var dir = Math.atan2(q1[1] - q0[1], q1[0] - q0[0]) + (r() < 0.5 ? -1 : 1) * (0.5 + r() * 0.5);
        origins.push([q1[0], q1[1], dir]);
      }
      if (origins.length) {
        var side = grow({ seed: id, origins: origins, step: 6, steps: 18, wander: 0.5, branch: 0.1, maxTips: origins.length * 3, maxDepth: 2, maxLen: 14,
          inside: function (x, y) { return x > 0 && y > 0 && x < w && y < h; } });
        side.forEach(function (sp) { sp.born = 0; });
        var sg = el("g", {});
        drawHyphae(sg, side, { width: 1, minWidth: 0.5, animate: false, tipEvery: 2, tipR: 1.2 });
        if (animate) sg.style.animation = "em-fade 1200ms ease-out " + (start + dur * 0.6).toFixed(0) + "ms both";
        sideG.appendChild(sg);
      }
    });

    // worlds: a planet with an orbit and a small colony inside
    var worldG = el("g", { "class": "connect__worlds-art" });
    svg.appendChild(worldG);
    links.forEach(function (a, i) {
      var hub = a.classList.contains("world--hub");
      var R = (hub ? 34 : 24) * (small ? 0.82 : 1);
      var x = pos[i][0], y = pos[i][1];
      var wr = rng(a.getAttribute("data-seed") + "#world");
      var g = el("g", { "class": "w" + (hub ? " w--hub" : ""), "data-i": i });
      var tilt = (wr() - 0.5) * 50;
      g.appendChild(el("ellipse", { cx: x, cy: y, rx: (R * 1.75).toFixed(1), ry: (R * 0.42).toFixed(1), transform: "rotate(" + tilt.toFixed(1) + " " + x.toFixed(1) + " " + y.toFixed(1) + ")", "class": "w__orbit" }));
      g.appendChild(el("circle", { cx: x, cy: y, r: R, "class": "w__body" }));
      var k = 3 + Math.floor(wr() * 3), turn = wr() * 6.28, org = [];
      for (var q = 0; q < k; q++) org.push([x, y, turn + q / k * 6.28]);
      var col = grow({ seed: a.getAttribute("data-seed"), origins: org, step: R / 9, steps: 30, wander: 0.6, branch: 0.14, maxTips: 30, maxDepth: 3, maxLen: 12,
        steer: function (px, py, an) { var o = Math.atan2(py - y, px - x); return Math.atan2(Math.sin(o - an), Math.cos(o - an)) * 0.08; },
        inside: function (px, py) { return Math.hypot(px - x, py - y) < R - 3; } });
      var cg = el("g", { "class": "w__colony" });
      drawHyphae(cg, col, { width: hub ? 1.6 : 1.3, minWidth: 0.5, animate: false, tipEvery: 3, tipR: 1.1 });
      g.appendChild(cg);
      g.appendChild(el("circle", { cx: x, cy: y, r: hub ? 4 : 2.6, "class": "w__core" }));
      if (animate) g.style.animation = "em-pop 800ms cubic-bezier(.2,.8,.3,1.2) " + Math.max(0, (reached[i] || 0) - 380).toFixed(0) + "ms both";
      worldG.appendChild(g);

      a.style.left = x + "px";
      a.style.top = y + "px";
      a.style.setProperty("--r", R + "px");
      if (animate) a.style.animation = "em-fade 700ms ease-out " + ((reached[i] || 0) + 100).toFixed(0) + "ms both";
      else a.style.animation = "none";
    });

    // signals travelling along the links once everything has grown
    if (!reduceMotion) {
      var pg = el("g", { "class": "connect__pulses" });
      svg.appendChild(pg);
      paths.forEach(function (p, k) {
        var dur = Math.max(3.5, p.len / 55);
        var begin = ((animate ? finish : 0) / 1000 + r() * dur).toFixed(2) + "s";
        var back = r() < 0.5;
        var dot = el("circle", { r: small ? 2.2 : 2.6, "class": "pulse", opacity: "0" });
        var mo = el("animateMotion", { dur: dur.toFixed(2) + "s", repeatCount: "indefinite", begin: begin, keyPoints: back ? "1;0" : "0;1", keyTimes: "0;1", calcMode: "linear" });
        var mp = el("mpath", { href: "#" + p.id });
        mp.setAttributeNS("http://www.w3.org/1999/xlink", "xlink:href", "#" + p.id);
        mo.appendChild(mp);
        var fade = el("animate", { attributeName: "opacity", values: "0;1;1;0", keyTimes: "0;0.12;0.85;1", dur: dur.toFixed(2) + "s", repeatCount: "indefinite", begin: begin });
        dot.appendChild(mo); dot.appendChild(fade);
        pg.appendChild(dot);
      });
    }

    // pointing at a world lights up its links
    var light = function (i, on) {
      Array.prototype.forEach.call(edgeG.querySelectorAll(".link"), function (p) {
        if (+p.getAttribute("data-a") === i || +p.getAttribute("data-b") === i) p.classList.toggle("is-lit", on);
      });
      var wg = worldG.querySelector('.w[data-i="' + i + '"]');
      if (wg) wg.classList.toggle("is-lit", on);
    };
    links.forEach(function (a, i) {
      if (a._emBound) { a._emLight = light; return; }
      a._emBound = true; a._emLight = light;
      var on = function () { a._emLight(i, true); }, off = function () { a._emLight(i, false); };
      a.addEventListener("mouseenter", on); a.addEventListener("mouseleave", off);
      a.addEventListener("focus", on); a.addEventListener("blur", off);
    });
    box.classList.add("connect--live");
  }

  /* ---------- essays: a vine down the left margin ----------
   * It grows as you read: the stem reaches as far as you have scrolled,
   * leaves unfurl as it passes them, a flower opens beside each section
   * heading, and a larger one at the end of the essay.
   */
  function leafPath(L, W) {
    // a pointed, slightly heart-based leaf from (0,0) to (L,0)
    return "M0 0C" + (L * 0.1).toFixed(1) + " " + (-W * 1.05).toFixed(1) + " " + (L * 0.62).toFixed(1) + " " + (-W * 0.95).toFixed(1) + " " + L.toFixed(1) + " 0" +
           "C" + (L * 0.62).toFixed(1) + " " + (W * 0.95).toFixed(1) + " " + (L * 0.1).toFixed(1) + " " + (W * 1.05).toFixed(1) + " 0 0Z";
  }
  function flowerG(x, y, R, cls, rr, double) {
    var g = el("g", { "class": cls, transform: "translate(" + x.toFixed(1) + " " + y.toFixed(1) + ")" });
    var inner = el("g", { "class": "vf__inner" });
    var turn = rr() * 72;
    for (var s = 0; s < 5; s++) {                    // green sepals peeking between the petals
      inner.appendChild(el("path", { d: "M0 0L" + (R * 0.95).toFixed(1) + " " + (-R * 0.12).toFixed(1) + "L" + (R * 1.05).toFixed(1) + " 0L" + (R * 0.95).toFixed(1) + " " + (R * 0.12).toFixed(1) + "Z",
        transform: "rotate(" + (turn + 36 + s * 72).toFixed(1) + ")", "class": "vf__sepal" }));
    }
    if (double) {
      for (var o = 0; o < 5; o++) {
        inner.appendChild(el("ellipse", { cx: (R * 0.62).toFixed(1), cy: 0, rx: (R * 0.62).toFixed(1), ry: (R * 0.4).toFixed(1),
          transform: "rotate(" + (turn + 36 + o * 72).toFixed(1) + ")", "class": "vf__petal vf__petal--back" }));
      }
    }
    for (var k = 0; k < 5; k++) {
      inner.appendChild(el("ellipse", { cx: (R * 0.55).toFixed(1), cy: 0, rx: (R * 0.55).toFixed(1), ry: (R * 0.36).toFixed(1),
        transform: "rotate(" + (turn + k * 72).toFixed(1) + ")", "class": "vf__petal" }));
    }
    inner.appendChild(el("circle", { cx: 0, cy: 0, r: (R * 0.24).toFixed(1), "class": "vf__heart" }));
    for (var d = 0; d < 6; d++) {                    // stamens
      var a = d * 1.047 + turn;
      inner.appendChild(el("circle", { cx: (Math.cos(a) * R * 0.34).toFixed(1), cy: (Math.sin(a) * R * 0.34).toFixed(1), r: (R * 0.06 + 0.4).toFixed(1), "class": "vf__stamen" }));
    }
    g.appendChild(inner);
    return g;
  }

  var vineState = null;
  function vine(sheet) {
    var body = sheet.querySelector(".sheet__body");
    if (!body) return;
    var old = sheet.querySelector(".vine");
    if (old) old.remove();
    vineState = null;
    var bodyMargin = parseFloat(getComputedStyle(body).marginLeft) || 0;
    if (bodyMargin < 100) return;                     // no margin to grow in (phones, tablets)

    var sr = sheet.getBoundingClientRect(), br = body.getBoundingClientRect();
    var rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    var gutter = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--gutter")) * rem || 48;
    var colW = bodyMargin - gutter;                   // the left margin column
    var left = br.left - sr.left - bodyMargin;
    var top = br.top - sr.top - 10;
    var H = Math.round(br.height + 80);              // room at the end for the last bloom
    var W = Math.round(colW);
    var r = rng((sheet.querySelector(".sheet__title") || body).textContent + "#vine");

    var svg = el("svg", { "class": "vine", viewBox: "0 0 " + W + " " + H, width: W, height: H, "aria-hidden": "true", focusable: "false" });
    svg.style.left = left + "px";
    svg.style.top = top + "px";

    // the stem: two slow waves layered, kept inside the margin column
    var cx = W * 0.5, A = W * 0.2, P1 = 300 + r() * 120, P2 = 110 + r() * 40, ph1 = r() * 6.28, ph2 = r() * 6.28;
    var stemX = function (y) {
      var ramp = Math.min(1, y / 160);                // starts calm under the title
      return cx + ramp * (A * Math.sin(ph1 + y / P1 * 6.28) * 0.85 + A * 0.32 * Math.sin(ph2 + y / P2 * 6.28));
    };
    var pts = [];
    for (var y = 0; y <= H; y += 8) pts.push([stemX(y), y]);
    var stem = el("path", { d: pathD(pts), "class": "vine__stem", pathLength: "1" });
    // a thinner shoot twining round the main stem
    var twin = [], tw0 = 120, tw1 = H * 0.92;
    for (var y2 = tw0; y2 <= tw1; y2 += 6) twin.push([stemX(y2) + 6.5 * Math.sin(y2 / 26 + 1.3), y2]);
    var twine = el("path", { d: pathD(twin), "class": "vine__twine", pathLength: "1" });
    svg.appendChild(twine);
    svg.appendChild(stem);

    var parts = [];                                   // things that appear as the stem passes them
    var at = function (y) { return [stemX(y), y]; };
    var dirAt = function (y) { var a = at(y - 4), b = at(y + 4); return Math.atan2(b[1] - a[1], b[0] - a[0]); };

    // section headings get a flower beside them
    var flowersAt = [];
    Array.prototype.forEach.call(body.querySelectorAll(":scope > h2"), function (h) {
      var hy = h.getBoundingClientRect().top - br.top + 10 + 16;
      if (hy > 40 && hy < H - 60) flowersAt.push(hy);
    });

    // leaves, alternating sides, every 46–80px; tendrils now and then
    var side = 1, ly = 46, n = 0;
    while (ly < H - 70) {
      var near = flowersAt.some(function (fy) { return Math.abs(fy - ly) < 26; });
      if (!near) {
        var p = at(ly), d = dirAt(ly);
        var room = side > 0 ? W - 6 - p[0] : p[0] - 6;  // keep leaves inside the column
        var L = Math.min(21 + r() * 15, Math.max(10, room * 0.78));
        var Wd = L * (0.4 + r() * 0.12);
        var ang = d + side * (0.75 + r() * 0.5);         // hang outward and down
        var pet = 4 + r() * 4;
        var bx = p[0] + Math.cos(ang) * pet, by = p[1] + Math.sin(ang) * pet;
        var g = el("g", { "class": "vine__part vl", "data-y": ly.toFixed(0) });
        g.appendChild(el("path", { d: "M" + p[0].toFixed(1) + " " + p[1].toFixed(1) + "L" + bx.toFixed(1) + " " + by.toFixed(1), "class": "vl__stalk" }));
        var leaf = el("g", { transform: "translate(" + bx.toFixed(1) + " " + by.toFixed(1) + ") rotate(" + (ang * 57.2958).toFixed(1) + ")" });
        leaf.appendChild(el("path", { d: leafPath(L, Wd), "class": "vl__blade" + (r() < 0.18 ? " vl__blade--warm" : "") }));
        leaf.appendChild(el("path", { d: "M1 0L" + (L * 0.82).toFixed(1) + " 0", "class": "vl__vein" }));
        g.appendChild(leaf);
        parts.push({ y: ly, el: g });
        // a curling tendril on the opposite side, every few leaves
        if (n % 3 === 1) {
          var ta = d - side * (0.9 + r() * 0.4), tl = 10 + r() * 8, tx = p[0] + Math.cos(ta) * tl, ty = p[1] + Math.sin(ta) * tl;
          var tp = "M" + p[0].toFixed(1) + " " + p[1].toFixed(1) + "Q" + (p[0] + Math.cos(ta - side * 0.3) * tl * 0.6).toFixed(1) + " " + (p[1] + Math.sin(ta - side * 0.3) * tl * 0.6).toFixed(1) + " " + tx.toFixed(1) + " " + ty.toFixed(1);
          var R0 = 5.5 + r() * 2.5, ccx = tx + Math.cos(ta + side * 1.5708) * R0, ccy = ty + Math.sin(ta + side * 1.5708) * R0;
          var a0 = Math.atan2(ty - ccy, tx - ccx);
          for (var k = 1; k <= 22; k++) {
            var tt = k / 22, aa = a0 - side * tt * 9.4, rr = R0 * (1 - tt * 0.8);
            if (Math.abs(ccx + Math.cos(aa) * rr - W / 2) > W / 2 - 2) break;
            tp += "L" + (ccx + Math.cos(aa) * rr).toFixed(1) + " " + (ccy + Math.sin(aa) * rr).toFixed(1);
          }
          var tg = el("g", { "class": "vine__part vt", "data-y": (ly + 6).toFixed(0) });
          tg.appendChild(el("path", { d: tp, "class": "vt__curl" }));
          parts.push({ y: ly + 6, el: tg });
        }
        // a closed bud on a short stalk
        if (r() < 0.1) {
          var ua = d - side * 0.9, ux = p[0] + Math.cos(ua) * 11, uy = p[1] + Math.sin(ua) * 11;
          var ug = el("g", { "class": "vine__part vu", "data-y": (ly + 8).toFixed(0) });
          ug.appendChild(el("path", { d: "M" + p[0].toFixed(1) + " " + p[1].toFixed(1) + "L" + ux.toFixed(1) + " " + uy.toFixed(1), "class": "vl__stalk" }));
          var bud = el("g", { transform: "translate(" + ux.toFixed(1) + " " + uy.toFixed(1) + ") rotate(" + (ua * 57.2958).toFixed(1) + ")" });
          bud.appendChild(el("path", { d: "M0 0C2 -4.5 7 -4 9 0C7 4 2 4.5 0 0Z", "class": "vu__bud" }));
          bud.appendChild(el("path", { d: "M0 0L4 -3M0 0L4 3", "class": "vl__stalk" }));
          ug.appendChild(bud);
          parts.push({ y: ly + 8, el: ug });
        }
        // a few berries
        else if (r() < 0.12) {
          var bg = el("g", { "class": "vine__part vb", "data-y": (ly + 10).toFixed(0) });
          var ba = d - side * 1.1, bx0 = p[0] + Math.cos(ba) * 9, by0 = p[1] + Math.sin(ba) * 9 + 6;
          bg.appendChild(el("path", { d: "M" + p[0].toFixed(1) + " " + p[1].toFixed(1) + "L" + bx0.toFixed(1) + " " + (by0 - 4).toFixed(1), "class": "vl__stalk" }));
          [[0, 0], [4.2, 2.4], [-1, 4.6]].forEach(function (o) {
            bg.appendChild(el("circle", { cx: (bx0 + o[0]).toFixed(1), cy: (by0 + o[1]).toFixed(1), r: 2.4, "class": "vb__berry" }));
          });
          parts.push({ y: ly + 10, el: bg });
        }
        side = -side; n++;
      }
      ly += 34 + r() * 30;
    }

    // flowers beside headings, and the last bloom at the end
    flowersAt.forEach(function (fy) {
      var p = at(fy);
      var f = flowerG(p[0], p[1], 15 + r() * 3, "vine__part vf", r, false);
      f.setAttribute("data-y", fy.toFixed(0));
      parts.push({ y: fy, el: f });
    });
    var end = at(H - 48);
    var last = flowerG(end[0], end[1], 26, "vine__part vf vf--last", r, true);
    last.setAttribute("data-y", (H - 48).toFixed(0));
    parts.push({ y: H - 48, el: last });

    var partsG = el("g", { "class": "vine__parts" });
    parts.sort(function (a, b) { return a.y - b.y; }).forEach(function (q) { partsG.appendChild(q.el); });
    svg.appendChild(partsG);
    sheet.appendChild(svg);

    vineState = { svg: svg, stem: stem, twine: twine, parts: parts, H: H, tw0: tw0, tw1: tw1 };
    if (reduceMotion) {
      svg.classList.add("vine--grown");
      parts.forEach(function (q) { q.el.classList.add("is-open"); });
    } else {
      growVine();
    }
  }

  function growVine() {
    var v = vineState;
    if (!v || reduceMotion) return;                    // reduced motion: it stays fully grown
    var rect = v.svg.getBoundingClientRect();
    // the tip sits a little below the middle of the screen
    var reach = Math.max(0, Math.min(v.H, window.innerHeight * 0.62 - rect.top));
    var f = reach / v.H;
    v.stem.style.strokeDashoffset = (1 - f).toFixed(4);
    var tf = Math.max(0, Math.min(1, (reach - v.tw0) / (v.tw1 - v.tw0)));
    v.twine.style.strokeDashoffset = (1 - tf).toFixed(4);
    for (var i = 0; i < v.parts.length; i++) {
      var q = v.parts[i];
      var open = q.y <= reach;
      if (open !== q.open) { q.open = open; q.el.classList.toggle("is-open", open); }
    }
  }

  /* ---------- sidenotes ---------- */
  function sidenotes() {
    var refs = document.querySelectorAll(".sheet__body sup[id^='fnref'], .sheet__body sup[role='doc-noteref']");
    Array.prototype.forEach.call(refs, function (sup) {
      if (sup.nextElementSibling && sup.nextElementSibling.classList.contains("sidenote")) return;
      var a = sup.querySelector("a[href^='#']");
      if (!a) return;
      var target = document.getElementById(decodeURIComponent(a.getAttribute("href").slice(1)));
      if (!target) return;
      var copy = target.cloneNode(true);
      Array.prototype.forEach.call(copy.querySelectorAll(".reversefootnote, [role='doc-backlink']"), function (x) { x.remove(); });
      var note = document.createElement("span");
      note.className = "sidenote";
      note.setAttribute("aria-hidden", "true");
      var num = document.createElement("span");
      num.className = "sidenote__num";
      num.textContent = a.textContent;
      note.appendChild(num);
      var body = document.createElement("span");
      var p = copy.querySelector("p");
      body.innerHTML = " " + (p ? p.innerHTML : copy.innerHTML).trim();
      note.appendChild(body);
      sup.parentNode.insertBefore(note, sup.nextSibling);
    });
    if (refs.length) document.documentElement.classList.add("has-sidenotes");
  }

  /* ---------- copy link ---------- */
  function copyLinks() {
    Array.prototype.forEach.call(document.querySelectorAll(".copy-link"), function (b) {
      b.addEventListener("click", function () {
        var url = b.getAttribute("data-url");
        var done = function () { b.textContent = "Link copied"; setTimeout(function () { b.textContent = "Copy link"; }, 2200); };
        if (navigator.clipboard) navigator.clipboard.writeText(url).then(done, function () { window.prompt("Copy this link:", url); });
        else window.prompt("Copy this link:", url);
      });
    });
  }

  function init() {
    Array.prototype.forEach.call(document.querySelectorAll(".plate[data-seed]"), plate);
    sidenotes();
    marginalia();
    copyLinks();
    var post = document.querySelector(".sheet--post");
    if (post) {
      var start = function () { vine(post); };
      start();
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(start);
      window.addEventListener("load", start);
      var vineW = window.innerWidth, vineT, ticking = false;
      window.addEventListener("resize", function () {
        clearTimeout(vineT);
        vineT = setTimeout(function () { if (Math.abs(window.innerWidth - vineW) > 30) { vineW = window.innerWidth; start(); } }, 250);
      });
      window.addEventListener("scroll", function () {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(function () { ticking = false; growVine(); });
      }, { passive: true });
    }
    var net = document.querySelector(".connect");
    if (net) {
      net.classList.add("connect--live");          // lay out first, so text positions are final
      connect(net, !reduceMotion);
      var netW = net.clientWidth, netT;
      window.addEventListener("resize", function () {
        clearTimeout(netT);
        netT = setTimeout(function () {
          if (Math.abs(net.clientWidth - netW) > 40) { netW = net.clientWidth; connect(net, false); }
        }, 200);
      });
    }
    var sc = document.querySelector(".scene");
    if (sc) {
      scene(sc, !reduceMotion);
      var scW = sc.clientWidth, scT;
      window.addEventListener("resize", function () {
        clearTimeout(scT);
        scT = setTimeout(function () {
          if (Math.abs(sc.clientWidth - scW) > 40) { scW = sc.clientWidth; scene(sc, false); }
        }, 200);
      });
    }
    var box = document.querySelector(".hero__net");
    if (box) {
      heroNet(box, !reduceMotion);
      var lastW = box.clientWidth, timer;
      window.addEventListener("resize", function () {
        clearTimeout(timer);
        timer = setTimeout(function () {
          if (Math.abs(box.clientWidth - lastW) > 40) { lastW = box.clientWidth; heroNet(box, false); }
        }, 200);
      });
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
