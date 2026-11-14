/*
 * Epistemic Margins
 * 1. Mycelium: a seeded hyphal network on the home page, and a small
 *    "culture plate" per essay, grown from the essay title so each
 *    piece always gets the same drawing.
 * 2. Sidenotes: footnotes are copied into the right-hand margin on
 *    wide screens. The footnote list at the end stays for everyone else.
 * 3. Nature: a landscape cross-section and margin drawings (About page).
 * 4. Copy link button on posts.
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
    var svg = el("svg", { viewBox: "0 0 " + w + " " + h, width: w, height: h, "class": "hero__svg", focusable: "false" });
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

    // topics sit on far-reaching branch ends, spread apart
    var labels = Array.prototype.slice.call(box.querySelectorAll(".hero__topic"));
    if (!labels.length) return;
    // keep labels clear of the wordmark and the introduction
    var origin = box.getBoundingClientRect();
    var avoid = [];
    Array.prototype.forEach.call(document.querySelectorAll(".hero__word, .hero__lede p"), function (n) {
      var range = document.createRange();
      range.selectNodeContents(n);
      var b = range.getBoundingClientRect();
      avoid.push([b.left - origin.left - 24, b.top - origin.top - 24, b.right - origin.left + 24, b.bottom - origin.top + 24]);
    });
    var clear = function (x, y) {
      var lab = [x - 14, y - 16, x + 200, y + 16];
      return avoid.every(function (a) { return lab[2] < a[0] || lab[0] > a[2] || lab[3] < a[1] || lab[1] > a[3]; });
    };
    var cands = tips.filter(function (p) {
      var l = p.pts[p.pts.length - 1];
      return p.depth <= 2 && p.pts.length > 8 && l[0] > w * 0.35 && l[0] < w - 190 && l[1] > h * 0.16 && l[1] < h * 0.8 && clear(l[0], l[1]);
    });
    if (small) labels.forEach(function (n) { n.hidden = true; });
    if (small || !cands.length) return;
    var chosen = [cands[0]];
    while (chosen.length < labels.length && chosen.length < cands.length) {
      var best = null, bestD = -1;
      cands.forEach(function (c) {
        if (chosen.indexOf(c) > -1) return;
        var cl = c.pts[c.pts.length - 1];
        var dmin = Infinity;
        chosen.forEach(function (s) {
          var sl = s.pts[s.pts.length - 1];
          var dx = cl[0] - sl[0], dy = (cl[1] - sl[1]) * 1.6;
          dmin = Math.min(dmin, dx * dx + dy * dy);
        });
        if (dmin > bestD) { bestD = dmin; best = c; }
      });
      chosen.push(best);
    }
    var ng = el("g", { "class": "nodes" });
    labels.forEach(function (n, i) {
      var c = chosen[i];
      if (!c) { n.hidden = true; return; }
      var l = c.pts[c.pts.length - 1];
      var dot = el("circle", { cx: l[0].toFixed(1), cy: l[1].toFixed(1), r: 4, "class": "node" });
      var halo = el("circle", { cx: l[0].toFixed(1), cy: l[1].toFixed(1), r: 10, "class": "node-halo" });
      n.hidden = false;
      n.style.left = l[0] + "px";
      n.style.top = l[1] + "px";
      if (animate) {
        var t = (c.doneAt || 0) + 120;
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
