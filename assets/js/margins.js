/*
 * Epistemic Margins
 * 1. Mycelium: a seeded hyphal network on the home page, and a small
 *    "culture plate" per essay, grown from the essay title so each
 *    piece always gets the same drawing.
 * 2. Sidenotes: footnotes are copied into the right-hand margin on
 *    wide screens. The footnote list at the end stays for everyone else.
 * 3. Copy link button on posts.
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
    copyLinks();
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
