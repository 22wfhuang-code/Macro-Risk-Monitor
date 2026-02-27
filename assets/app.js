/* ============================================================
   Fairt Risk Monitor — Frontend v7 (Multi-page static)
   - Auto propagate query (?date=)
   - Home / Dashboard / Topic pages
   - Deterministic rendering (data is deterministic; UI is stable)
============================================================ */

/* ---------- Utilities ---------- */
function $(id){ return document.getElementById(id); }

function setText(id, v){
  const el = $(id);
  if (el) el.textContent = (v === undefined || v === null || v === "") ? "—" : String(v);
}

function setHTML(id, v){
  const el = $(id);
  if (el) el.innerHTML = v ?? "";
}

function fmt1(v){
  if (v === undefined || v === null || isNaN(v)) return "—";
  return Number(v).toFixed(1);
}

function fmt2(v){
  if (v === undefined || v === null || isNaN(v)) return "—";
  return Number(v).toFixed(2);
}

function esc(s){
  return String(s ?? "")
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;");
}

function qs(){
  return Object.fromEntries(new URL(location.href).searchParams.entries());
}

async function getJSON(url){
  const r = await fetch(url, {cache:"no-store"});
  if (!r.ok) throw new Error(`fetch fail: ${url}`);
  return await r.json();
}

/* ---------- Key fix: propagate query across internal links ---------- */
function propagateQueryToInternalLinks(){
  const cur = new URL(location.href);
  const params = cur.searchParams;
  if (![...params.keys()].length) return;

  document.querySelectorAll("a[href]").forEach(a=>{
    const href = a.getAttribute("href");
    if (!href) return;
    if (href.startsWith("http") || href.startsWith("mailto:") || href.startsWith("#")) return;
    if (!href.includes(".html")) return;

    const target = new URL(href, cur);
    params.forEach((v,k)=>{
      if (!target.searchParams.has(k)) target.searchParams.set(k,v);
    });

    const rel = target.pathname.split("/").pop()
      + (target.search ? target.search : "")
      + (target.hash ? target.hash : "");

    a.setAttribute("href", href.startsWith("./") ? "./"+rel : rel);
  });
}

/* ---------- Regime ---------- */
function regimeOf(score){
  const s = Number(score);
  if (!Number.isFinite(s)) return "neutral";
  if (s < 40) return "low";
  if (s < 55) return "neutral";
  if (s < 70) return "elevated";
  return "stress";
}

function regimeLabel(r){
  return {
    low:"LOW",
    neutral:"NEUTRAL",
    elevated:"ELEVATED",
    stress:"STRESS"
  }[r] ?? "—";
}

/* ---------- Small render helpers ---------- */
function tableRows(arr, kKey, vKey, mode, limit){
  const rows = (arr || []).slice(0, limit ?? 8).map(x=>{
    const k = esc(x?.[kKey] ?? "—");
    const v = (mode === "score") ? fmt1(x?.[vKey]) : fmt2(x?.[vKey]);
    const cls = (mode === "contrib")
      ? (Number(x?.[vKey]) >= 0 ? "good" : "bad")
      : "mid";
    return `<div class="row"><div class="k">${k}</div><div class="v mono ${cls}">${esc(v)}</div></div>`;
  }).join("");
  return rows || `<div class="row"><div class="k muted">—</div><div class="v mono">—</div></div>`;
}

function daysBetween(a, b){
  try{
    const da = new Date(a+"T00:00:00Z");
    const db = new Date(b+"T00:00:00Z");
    const ms = db - da;
    return Math.max(0, Math.round(ms / 86400000));
  }catch(e){ return 0; }
}

function buildRegimeLog(history, maxItems){
  const h = (history || []).filter(x=>x && x.date).slice().sort((a,b)=>String(a.date).localeCompare(String(b.date)));
  if (h.length < 2) return [];
  const out = [];
  let prevR = regimeOf(h[0].score ?? h[0].ema);
  let startDate = h[0].date;

  for (let i=1;i<h.length;i++){
    const r = regimeOf(h[i].score ?? h[i].ema);
    if (r !== prevR){
      out.push({date: h[i].date, from: prevR, to: r, dur: daysBetween(startDate, h[i].date), score: Number(h[i].score ?? h[i].ema)});
      prevR = r;
      startDate = h[i].date;
    }
  }
  out.reverse();
  return (maxItems ? out.slice(0, maxItems) : out);
}

/* ---------- Charts (Chart.js) ---------- */
function makeLine(ctx, labels, data, _label){
  if (!ctx) return;
  new Chart(ctx,{
    type:"line",
    data:{
      labels,
      datasets:[{
        label: _label || "",
        data,
        borderColor:"rgba(138,180,255,1)",
        tension:.25,
        fill:false,
        pointRadius:0
      }]
    },
    options:{
      responsive:true,
      plugins:{legend:{display:false}},
      scales:{x:{display:false}, y:{display:true, ticks:{display:true}}}
    }
  });
}

function makeMultiLine(ctx, labels, seriesList){
  if (!ctx) return;
  new Chart(ctx,{
    type:"line",
    data:{
      labels,
      datasets:(seriesList||[]).map(s=>({
        label: s.label,
        data: s.data,
        tension:.25,
        fill:false,
        pointRadius:0
      }))
    },
    options:{
      responsive:true,
      plugins:{legend:{display:true}},
      scales:{x:{display:false}, y:{display:true}}
    }
  });
}

function makeBar(ctx, labels, data, _label){
  if (!ctx) return;
  new Chart(ctx,{
    type:"bar",
    data:{
      labels,
      datasets:[{
        label:_label||"",
        data,
        backgroundColor:"rgba(138,180,255,.85)"
      }]
    },
    options:{
      responsive:true,
      plugins:{legend:{display:false}},
      scales:{x:{display:false}, y:{display:true}}
    }
  });
}

function makePie(ctx, labels, data){
  if (!ctx) return;
  new Chart(ctx,{
    type:"doughnut",
    data:{ labels, datasets:[{ data }] },
    options:{ responsive:true, plugins:{legend:{position:"bottom"}} }
  });
}

function makeRadar(ctx, labels, data){
  if (!ctx) return;
  new Chart(ctx,{
    type:"radar",
    data:{ labels, datasets:[{ data, fill:true }] },
    options:{ responsive:true, plugins:{legend:{display:false}} }
  });
}

function makeGauge(ctx, score){
  if (!ctx) return;
  const v = Math.max(0, Math.min(100, Number(score)||0));
  new Chart(ctx,{
    type:"doughnut",
    data:{
      labels:["risk","rest"],
      datasets:[{
        data:[v, 100-v],
        backgroundColor:["rgba(255,99,132,.9)","rgba(255,255,255,.08)"],
        borderWidth:0
      }]
    },
    options:{
      responsive:true,
      cutout:"75%",
      plugins:{
        legend:{display:false},
        tooltip:{enabled:false}
      }
    },
    plugins:[{
      id:"centerText",
      afterDraw(chart){
        const {ctx, chartArea} = chart;
        if (!chartArea) return;
        const x = (chartArea.left + chartArea.right) / 2;
        const y = chartArea.top + (chartArea.bottom - chartArea.top) * 0.78;
        ctx.save();
        ctx.fillStyle = "rgba(255,255,255,.86)";
        ctx.font = "700 18px ui-monospace, Menlo, Consolas, monospace";
        ctx.textAlign = "center";
        ctx.fillText(String(Math.round(v)), x, y);
        ctx.restore();
      }
    }]
  });
}

/* ---------- UI widgets ---------- */
function renderTimeline(el, history){
  if (!el) return;
  const tail = (history || []).slice(-50);
  const cells = tail.map((h, i)=>{
    const r = regimeOf(h.score ?? h.ema);
    const active = (i === tail.length - 1) ? 'data-active="true"' : "";
    const title = `${h.date} | ${fmt1(h.score ?? h.ema)} | ${r}`;
    return `<span class="tcell" data-r="${esc(r)}" ${active} title="${esc(title)}"></span>`;
  }).join("");
  el.innerHTML = cells || `<span class="muted">—</span>`;
}

function renderRegimeLog(el, history){
  if (!el) return;
  const log = buildRegimeLog(history || [], 12);
  if (!log.length){
    el.innerHTML = `<div class="row"><div class="k muted">—</div><div class="v mono">—</div></div>`;
    return;
  }
  el.innerHTML = log.map(x=>{
    const cls = (x.to==="low"||x.to==="neutral") ? "good" : (x.to==="stress" ? "bad" : "mid");
    return `<div class="row">
      <div class="k">${esc(x.date)} <span class="muted mono">(${esc(x.dur)}d)</span></div>
      <div class="v mono ${cls}">${esc(regimeLabel(x.from))} → ${esc(regimeLabel(x.to))}</div>
    </div>`;
  }).join("");
}

function histogram(values, bins){
  const arr = (values||[]).filter(v=>Number.isFinite(v)).map(Number);
  if (!arr.length) return {labels:[], counts:[]};
  const min = Math.min(...arr);
  const max = Math.max(...arr);
  const b = Math.max(2, bins||10);
  const step = (max - min) / b || 1;
  const counts = new Array(b).fill(0);
  for (const v of arr){
    let idx = Math.floor((v - min) / step);
    if (idx >= b) idx = b-1;
    if (idx < 0) idx = 0;
    counts[idx] += 1;
  }
  const labels = counts.map((_,i)=>{
    const lo = min + step*i;
    const hi = lo + step;
    return `${lo.toFixed(0)}-${hi.toFixed(0)}`;
  });
  return {labels, counts};
}

async function computeFactorStability(_topic, history, windowN){
  const h = (history||[]).slice(-Math.max(10, windowN||20));
  if (!h.length) return {stable:[], volatile:[]};
  const series = h.map(x=>x.factor_scores || {});
  const keys = new Set();
  series.forEach(s=>Object.keys(s||{}).forEach(k=>keys.add(k)));

  const stats = [];
  [...keys].forEach(k=>{
    const vals = series.map(s=>Number(s?.[k])).filter(v=>Number.isFinite(v));
    if (vals.length < 6) return;
    const mean = vals.reduce((a,b)=>a+b,0)/vals.length;
    const varr = vals.reduce((a,b)=>a+(b-mean)*(b-mean),0)/vals.length;
    const sd = Math.sqrt(varr);
    stats.push({k, sd, mean});
  });

  stats.sort((a,b)=>a.sd-b.sd);
  const stable = stats.slice(0,5).map(x=>x.k);
  const volatile = stats.slice(-5).reverse().map(x=>x.k);
  return {stable, volatile};
}

/* ---------- Home ---------- */
async function initHome(){
  propagateQueryToInternalLinks();

  const q = qs();
  const targetDate = q.date || null;

  const latest = await getJSON("./data/latest.json");
  const history = await getJSON("./data/history_stats.json").catch(()=>[]);

  let current = latest;
  let mode = "LATEST";
  if (targetDate){
    try{
      current = await getJSON(`./data/daily/${targetDate}.json`);
      mode = `DATE ${targetDate}`;
    }catch(e){
      mode = `DATE ${targetDate} (not found)`;
    }
  }

  setText("mode", mode);
  setText("asOf", current.as_of || current.meta?.timestamp || "—");
  setText("riskScore", fmt1(current.risk_score));
  setText("delta1d", fmt2(current.delta_1d));
  setText("regime", (current.regime || regimeOf(current.risk_score)).toUpperCase());
  setText("theme", current.mainline_theme || "—");

  // Decision hint
  setText("riskLevel", (current.risk_profile?.label || "—"));
  setText("assetHint", (current.risk_profile?.hint || "—"));
  setText("confidence", fmt2(current.confidence));

  // Risk Factors table
  setHTML("riskFactors", tableRows(current.risk_factors || [], "name", "score", "score", 8));

  // Asset bias (simple)
  const r = current.regime || regimeOf(current.risk_score);
  const bias = [
    {k:"Equity", v: (r==="low"||r==="neutral") ? "+1" : "-1"},
    {k:"Rates", v: (r==="stress") ? "+1" : "0"},
    {k:"Commod", v: (r==="low") ? "+1" : (r==="stress" ? "0" : "+0")},
    {k:"Gold",  v: (r==="stress"||r==="elevated") ? "+1" : "0"},
    {k:"Cash",  v: (r==="stress") ? "+2" : (r==="elevated" ? "+1" : "0")}
  ];
  setHTML("assetBias", bias.map(x=>{
    const cls = x.v.startsWith("+") ? "good" : (x.v.startsWith("-") ? "bad" : "mid");
    return `<div class="row"><div class="k">${esc(x.k)}</div><div class="v ${cls}">${esc(x.v)}</div></div>`;
  }).join(""));

  // Charts
  const labels = (history || []).slice(-60).map(h=>h.date);
  const series = (history || []).slice(-60).map(h=>Number(h.ema ?? h.score));
  makeLine($("spark")?.getContext("2d"), labels, series, "risk_ema");

  makeGauge($("gauge")?.getContext("2d"), current.risk_score);

  const ranked = (current.risk_factors || []).slice(0, 8);
  const clabels = ranked.map(x=>x.name);
  const cvals = ranked.map(x=>Number(x.contrib));
  makeBar($("contrib")?.getContext("2d"), clabels, cvals, "contrib");

  // widgets
  renderTimeline($("regimeTimeline"), history);
  renderHeatmap($("heatmap"), current.factor_scores || {});

  // Compare panel
  const cmpCard = $("compareCard");
  const btnCompare = $("btnCompare");
  const btnLatest = $("btnLatest");
  const btnShare = $("btnShare");
  const dateInput = $("dateInput");
  const btnGo = $("btnGo");

  function showCompare(on){
    if (!cmpCard) return;
    cmpCard.dataset.hidden = on ? "false" : "true";
    if (btnCompare) btnCompare.dataset.on = on ? "true" : "false";
  }

  if (btnGo && dateInput){
    btnGo.addEventListener("click", ()=>{
      const v = String(dateInput.value||"").trim();
      if (!v) return;
      const u = new URL(location.href);
      u.searchParams.set("date", v);
      location.href = u.toString();
    });
  }

  if (btnLatest){
    btnLatest.addEventListener("click", ()=>{
      const u = new URL(location.href);
      u.searchParams.delete("date");
      location.href = u.toString();
    });
  }

  if (btnCompare){
    btnCompare.addEventListener("click", ()=>{
      const on = (cmpCard?.dataset.hidden === "true");
      showCompare(on);
      if (on){
        const left = current;
        const right = latest;
        setText("cmpMeta", `Left=${left.date || targetDate || "latest"} vs Right=latest`);
        setText("cmpRisk", `${fmt1(left.risk_score)} → ${fmt1(right.risk_score)} (${fmt2((right.risk_score-left.risk_score)||0)})`);
        setText("cmpDelta", `${fmt2(left.delta_1d)} → ${fmt2(right.delta_1d)}`);
        setText("cmpRegime", `${String(left.regime||"—")} → ${String(right.regime||"—")}`);
        setText("cmpTheme", `${String(left.mainline_theme||"—")} → ${String(right.mainline_theme||"—")}`);

        const lf = (left.risk_factors||[])[0]?.name || "—";
        const rf = (right.risk_factors||[])[0]?.name || "—";
        setText("cmpTopFactor", `${lf} → ${rf}`);
      }
    });
  }

  if (btnShare){
    btnShare.addEventListener("click", async ()=>{
      const text = `Macro Risk Monitor | Risk=${fmt1(current.risk_score)} Δ=${fmt2(current.delta_1d)} Regime=${String(current.regime||"—")} Theme=${String(current.mainline_theme||"—")}`;
      setText("shareText", text);
      try{ await navigator.clipboard.writeText(text); }catch(e){}
    });
  }

  // archive tags
  const archiveIndex = await getJSON("./data/archive_index.json").catch(()=>({dates:[]}));
  const dates = (archiveIndex?.dates || []).slice(-18).reverse();
  const tagsEl = $("archiveTags");
  if (tagsEl){
    tagsEl.innerHTML = dates.map(d=>{
      const active = (d === targetDate) ? 'data-active="true"' : "";
      return `<span class="tag" ${active} data-date="${esc(d)}"><span class="mini"></span><span class="mono">${esc(d)}</span></span>`;
    }).join("");
    tagsEl.querySelectorAll(".tag").forEach(t=>{
      t.addEventListener("click", ()=>{
        const d = t.getAttribute("data-date");
        if (!d) return;
        const u = new URL(location.href);
        u.searchParams.set("date", d);
        location.href = u.toString();
      });
    });
  }
}

/* ---------- Heatmap for Home ---------- */
function renderHeatmap(el, factorScores){
  if (!el) return;
  const fs = factorScores || {};
  const keys = Object.keys(fs);
  if (!keys.length){
    el.innerHTML = `<div class="muted">—</div>`;
    return;
  }
  const items = keys.map(k=>{
    const v = Number(fs[k]);
    const a = Math.min(1, Math.max(0, Math.abs(v)/3));
    const cls = v>=0 ? "good" : "bad";
    return `<div class="hcell ${cls}" style="opacity:${0.25 + 0.65*a}">
      <div class="hk">${esc(k)}</div>
      <div class="hv mono">${esc(fmt2(v))}</div>
    </div>`;
  }).join("");
  el.innerHTML = `<div class="heat">${items}</div>`;
}

/* ---------- Dashboard ---------- */
async function initDashboard(){
  propagateQueryToInternalLinks();

  const topics = [
    {key:"macro",   prefix:"m", title:"宏观"},
    {key:"ashares", prefix:"a", title:"A股"},
    {key:"copper",  prefix:"c", title:"铜"},
  ];

  const packs = await Promise.all(topics.map(async t=>{
    try{
      const latest = await getJSON(`./data/${t.key}/latest.json`);
      const hist = await getJSON(`./data/${t.key}/history_stats.json`).catch(()=>[]);
      return {...t, latest, hist};
    }catch(e){
      return {...t, err: String(e)};
    }
  }));

  const metaDate = packs.find(p=>p.latest?.as_of)?.latest?.as_of || "—";
  setText("dashAsOf", metaDate);

  for (const p of packs){
    const L = p.latest;
    if (!L){
      setText(`${p.prefix}_err`, p.err || "missing");
      continue;
    }
    setText(`${p.prefix}_risk`, fmt1(L.risk_score));
    setText(`${p.prefix}_d1`, fmt2(L.delta_1d));
    setText(`${p.prefix}_reg`, String(L.regime||regimeOf(L.risk_score)).toUpperCase());
    setText(`${p.prefix}_theme`, L.mainline_theme || "—");
    setText(`${p.prefix}_asof`, L.as_of || "—");
    setHTML(`${p.prefix}_factors`, tableRows(L.risk_factors || [], "name", "score", "score", 4));
  }

  const m = packs.find(x=>x.key==="macro");
  const a = packs.find(x=>x.key==="ashares");
  const c = packs.find(x=>x.key==="copper");

  const baseDates = (m?.hist || []).slice(-60).map(x=>x.date);
  const mapSeries = (hist)=>{
    const mm = new Map((hist||[]).map(x=>[x.date, Number(x.ema ?? x.score)]));
    return baseDates.map(d=> mm.has(d) ? mm.get(d) : null);
  };

  const ctx = $("xtrend")?.getContext("2d");
  if (ctx && baseDates.length){
    makeMultiLine(ctx, baseDates, [
      {label:"macro", data: mapSeries(m?.hist)},
      {label:"ashares", data: mapSeries(a?.hist)},
      {label:"copper", data: mapSeries(c?.hist)},
    ]);
  }

  const mr = Number(m?.latest?.risk_score);
  const ar = Number(a?.latest?.risk_score);
  const cr = Number(c?.latest?.risk_score);
  function spread(x,y){ return (Number.isFinite(x)&&Number.isFinite(y)) ? (x-y) : null; }

  setText("spr_ma", Number.isFinite(spread(mr,ar)) ? fmt1(spread(mr,ar)) : "—");
  setText("spr_mc", Number.isFinite(spread(mr,cr)) ? fmt1(spread(mr,cr)) : "—");
  setText("spr_ac", Number.isFinite(spread(ar,cr)) ? fmt1(spread(ar,cr)) : "—");

  const switchEl = $("switchboard");
  if (switchEl){
    const rows = packs.map(p=>{
      const log = buildRegimeLog(p.hist || [], 1);
      const last = log[0];
      if (!last){
        return `<div class="row"><div class="k">${esc(p.title)}</div><div class="v mid mono">—</div></div>`;
      }
      const cls = (last.to==="low"||last.to==="neutral") ? "good" : (last.to==="stress" ? "bad" : "mid");
      return `<div class="row">
        <div class="k">${esc(p.title)} <span class="muted mono">(${esc(last.date)})</span></div>
        <div class="v ${cls} mono">${esc(regimeLabel(last.from))} → ${esc(regimeLabel(last.to))}</div>
      </div>`;
    }).join("");
    switchEl.innerHTML = rows || `<div class="muted">—</div>`;
  }
}

/* ---------- Topic pages (macro/ashares/copper) ---------- */
async function initTopic(topic){
  propagateQueryToInternalLinks();

  const q = qs();
  const targetDate = q.date || null;

  const latest = await getJSON(`./data/${topic}/latest.json`);
  const history = await getJSON(`./data/${topic}/history_stats.json`).catch(()=>[]);
  let current = latest;

  if (targetDate){
    try{
      current = await getJSON(`./data/${topic}/daily/${targetDate}.json`);
    }catch(e){
      // keep latest
    }
  }

  setText("date", targetDate || (current.date || "latest"));

  const insights = current?.briefing?.insights || [];
  setHTML("insights", (insights||[]).slice(0,3).map(x=>`<li>${esc(x)}</li>`).join("") || `<li class="muted">—</li>`);

  const toplist = (current?.briefing?.top || []).slice(0, 80);
  const listEl = $("toplist");
  const searchEl = $("search");

  function renderTop(filter){
    const kw = String(filter||"").trim().toLowerCase();
    const filtered = kw
      ? toplist.filter(x=> String(x).toLowerCase().includes(kw))
      : toplist;

    if (listEl){
      listEl.innerHTML = (filtered||[]).slice(0, 60).map(x=>`<li>${esc(x)}</li>`).join("") || `<li class="muted">—</li>`;
    }
  }

  if (searchEl){
    searchEl.addEventListener("input", ()=> renderTop(searchEl.value));
  }
  renderTop("");

  // distribution pies
  const dist = current?.distribution || {};
  const main = dist?.main_factors || dist?.main || {};
  const sub  = dist?.sub_factors  || dist?.sub  || {};

  const mainLabels = Object.keys(main || {});
  const mainVals = mainLabels.map(k=>Number(main[k]));
  makePie($("mainPie")?.getContext("2d"), mainLabels, mainVals);

  const subLabels = Object.keys(sub || {});
  const subVals = subLabels.map(k=>Number(sub[k]));
  makePie($("subPie")?.getContext("2d"), subLabels, subVals);

  const labels = (history || []).slice(-80).map(h=>h.date);
  const series = (history || []).slice(-80).map(h=>Number(h.ema ?? h.score));
  makeLine($("trend")?.getContext("2d"), labels, series, "risk_ema");

  makeGauge($("gauge")?.getContext("2d"), current.risk_score);

  const fs = current.factor_scores || {};
  const fkeys = Object.keys(fs);
  if (fkeys.length){
    makeRadar($("radar")?.getContext("2d"), fkeys, fkeys.map(k=>Number(fs[k])));
  }

  renderTimeline($("timeline"), history);
  renderRegimeLog($("regimeLog"), history);

  const hscores = (history || []).slice(-120).map(x=>Number(x.score ?? x.ema));
  const h = histogram(hscores, 10);
  makeBar($("hist")?.getContext("2d"), h.labels, h.counts, "count");

  const stable = await computeFactorStability(topic, history, 20).catch(()=>({stable:[], volatile:[]}));
  setText("stable", (stable.stable||[]).join(", ") || "—");
  setText("volatile", (stable.volatile||[]).join(", ") || "—");

  setText("k_risk", fmt1(current.risk_score));
  setText("k_d1", fmt2(current.delta_1d));
  setText("k_reg", String(current.regime||regimeOf(current.risk_score)).toUpperCase());
  setText("k_theme", current.mainline_theme || "—");

  setHTML("rfactors", tableRows(current.risk_factors || [], "name", "score", "score", 8));
  setHTML("rcontrib", tableRows(current.risk_factors || [], "name", "contrib", "contrib", 8));

  const dateInput = $("dateInput");
  const btnGo = $("btnGo");
  if (btnGo && dateInput){
    btnGo.addEventListener("click", ()=>{
      const v = String(dateInput.value||"").trim();
      if (!v) return;
      const u = new URL(location.href);
      u.searchParams.set("date", v);
      location.href = u.toString();
    });
  }
}

/* ---------- Boot ---------- */
const page = (document.body?.dataset?.page || "index").toLowerCase();

(async function boot(){
  try{
    if (page === "dashboard") return await initDashboard();
    if (page === "macro") return await initTopic("macro");
    if (page === "ashares") return await initTopic("ashares");
    if (page === "copper") return await initTopic("copper");
    return await initHome();
  }catch(e){
    const msg = String(e?.message || e);
    const el = $("err") || $("m_err") || $("a_err") || $("c_err");
    if (el) el.textContent = msg;
    else console.error(e);
  }
})();