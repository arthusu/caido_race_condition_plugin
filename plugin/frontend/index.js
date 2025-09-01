// frontend/index.js — Race Condition (agent-mode) v2.0.2
export function init(sdk) {
  const state = { queue: [], rows: [], logs: [], agentUrl: "http://127.0.0.1:8766" };
  const pageId = "/race-condition";
  const root = document.createElement("div"); root.className = "rc-root";
  const pageCard = sdk.ui.card({ header: document.createElement("h1"), body: document.createElement("div") });
  pageCard.querySelector("h1").textContent = "Race Condition";
  const container = pageCard.querySelector("div");
  root.append(pageCard);
  sdk.navigation.addPage(pageId, { body: root });
  sdk.sidebar.registerItem("Race Condition", pageId, { icon: "fas fa-bolt", group: "Plugins" });
  try { sdk.navigation.goTo(pageId); } catch {}

  const tabs = document.createElement("div"); tabs.className = "rc-tabs";
  const tabRun = Object.assign(document.createElement("button"), { className: "rc-tab rc-tab-active", textContent: "Runner" });
  const tabUsage = Object.assign(document.createElement("button"), { className: "rc-tab", textContent: "Usage" });
  const tabDebug = Object.assign(document.createElement("button"), { className: "rc-tab", textContent: "Debug" });
  tabs.append(tabRun, tabUsage, tabDebug);

  const runnerView = document.createElement("div"); runnerView.className="rc-runner";
  const usageView = document.createElement("div"); usageView.className="rc-usage"; usageView.style.display="none";
  const debugView = document.createElement("div"); debugView.className="rc-debug"; debugView.style.display="none";

  usageView.innerHTML = `<div class="rc-usage-wrap">
      <h2>How to use (Agent mode)</h2>
      <ol>
        <li>Run the local agent: <code>./rcsp-h1-agent</code> (listens on <code>127.0.0.1:8766</code>).</li>
        <li>Right‑click a request in <b>Replay</b> or <b>HTTP History</b> → <b>Add to Race queue</b>.</li>
        <li>Ensure all queued requests share the same <b>host:port</b> and <b>scheme</b>.</li>
        <li>Click <b>Connect</b> to check agent health, then <b>Run single‑packet (Agent)</b>.</li>
        <li>Use the <b>Live logs</b> toggle to see the agent's SSE output.</li>
      </ol>
    </div>`;
  container.append(tabs, runnerView, usageView, debugView);
  function showRunner(){ tabRun.classList.add("rc-tab-active"); tabUsage.classList.remove("rc-tab-active"); tabDebug.classList.remove("rc-tab-active"); runnerView.style.display="block"; usageView.style.display="none"; debugView.style.display="none"; }
  function showUsage(){ tabUsage.classList.add("rc-tab-active"); tabRun.classList.remove("rc-tab-active"); tabDebug.classList.remove("rc-tab-active"); runnerView.style.display="none"; usageView.style.display="block"; debugView.style.display="none"; }
  function showDebug(){ tabDebug.classList.add("rc-tab-active"); tabRun.classList.remove("rc-tab-active"); tabUsage.classList.remove("rc-tab-active"); runnerView.style.display="none"; usageView.style.display="none"; debugView.style.display="block"; }
  tabRun.onclick = showRunner; tabUsage.onclick = showUsage; tabDebug.onclick = showDebug; showRunner();

  const style = document.createElement("style");
  style.textContent = `
  .rc-root{min-height:calc(100vh - 64px);display:flex;flex-direction:column;gap:12px;padding-bottom:8px}
  .rc-top{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
  .rc-btn{background:#1f2937;color:#e5e7eb;border:none;border-radius:8px;padding:8px 12px;cursor:pointer}
  .rc-btn:hover{filter:brightness(1.1)} .rc-btn-primary{background:#111827}
  .rc-input{background:#0f172a;color:#e5e7eb;border:1px solid #374151;border-radius:8px;padding:8px 10px;min-width:280px}
  .rc-queue-body{max-height:220px;overflow:auto}
  .rc-table-host{max-height:320px;overflow:auto}
  .rc-raw{max-height:280px;overflow:auto;background:#0b0b0b;color:#e5e7eb;padding:8px;border-radius:8px}
  .rc-table{width:100%;border-collapse:collapse}
  .rc-table th,.rc-table td{border-bottom:1px solid #1f2937;padding:6px;font-family:ui-monospace,Menlo,monospace;font-size:12px}
  .rc-table tr:hover{background:rgba(255,255,255,.05);cursor:pointer}
  .rc-queue-item{display:grid;grid-template-columns: 1fr auto;gap:6px;align-items:center;border-bottom:1px dashed #333;padding:6px 0}
  .rc-detail-wrap.rc-only-raw{display:grid;grid-template-columns: 1fr;gap:12px;margin-top:10px}
  .rc-tabs{display:flex;gap:8px;margin-bottom:8px}
  .rc-tab{background:#111827;color:#e5e7eb;border:none;border-radius:9999px;padding:6px 12px;cursor:pointer}
  .rc-tab-active{background:#2563eb}
  .rc-usage{padding:8px}.rc-usage-wrap{max-width:900px;line-height:1.5}
  .rc-url{color:#93c5fd;text-decoration:underline;cursor:pointer}
  .rc-row-active{background:rgba(147,197,253,.12)!important}
  `;
  document.head.appendChild(style);

  function toast(msg, variant="info") { try { sdk.window.showToast(msg, { variant }); } catch {} }
  const addLog = (l)=>{ state.logs.push(l); if (state.logs.length>1000) state.logs.shift(); dbgPre.textContent = state.logs.join("\n"); };

  // Top bar
  const topBar = document.createElement("div"); topBar.className="rc-top";
  const iptAgent  = Object.assign(document.createElement("input"), { className:"rc-input", value: state.agentUrl });
  iptAgent.placeholder = "http://127.0.0.1:8766";
  iptAgent.onchange = ()=> state.agentUrl = iptAgent.value.trim();
  const btnConnect = Object.assign(document.createElement("button"), { className:"rc-btn", textContent: "Connect" });
  const btnLogs    = Object.assign(document.createElement("button"), { className:"rc-btn", textContent: "Live logs" });
  const btnRun     = Object.assign(document.createElement("button"), { className:"rc-btn rc-btn-primary", textContent: "Run single‑packet (Agent)" });
  const btnRunPar = Object.assign(document.createElement("button"), { className:"rc-btn", textContent: "Run parallel (Agent)" });
  const btnClear   = Object.assign(document.createElement("button"), { className:"rc-btn", textContent: "Clear queue" });
  const iptTimeout = Object.assign(document.createElement("input"), { className:"rc-input", value: "15000" }); iptTimeout.placeholder="Timeout ms"; iptTimeout.style.minWidth="140px";
const iptRetries = Object.assign(document.createElement("input"), { className:"rc-input", value: "2" }); iptRetries.placeholder="Retries"; iptRetries.style.minWidth="100px";
topBar.append(iptAgent, iptTimeout, iptRetries, btnConnect, btnLogs, btnRun, btnRunPar, btnClear);

  const queueBody = document.createElement("div"); queueBody.className="rc-queue-body";
  const queueCard = sdk.ui.card({ header: document.createTextNode("Queue (Replay/History → Add to Race queue)"), body: queueBody });

  const tableHost = document.createElement("div"); tableHost.className="rc-table-host";
  const reqPre = document.createElement("pre"); reqPre.className="rc-raw";
  const respPre = document.createElement("pre"); respPre.className="rc-raw";
  const detailWrap = document.createElement("div"); detailWrap.className="rc-detail-wrap rc-only-raw";
  detailWrap.append(reqPre, respPre);
  const resultsCard = sdk.ui.card({ header: document.createTextNode("#  Status  Code  RTT  Count  Method  URL"), body: tableHost, footer: detailWrap });

  // Debug
  const dbgPre = document.createElement("pre"); dbgPre.className="rc-raw";
  const dbgCard = sdk.ui.card({ header: document.createTextNode("Agent logs (SSE) / Debug"), body: dbgPre });
  debugView.append(dbgCard);

  runnerView.append(topBar, queueCard, resultsCard);

  // Queue render
  function renderQueue() {
    queueBody.innerHTML = "";
    if (!state.queue.length) { queueBody.textContent = "Empty. Right‑click a request in Replay or History → Add to Race queue."; return; }
    for (const it of state.queue) {
      const row = document.createElement("div"); row.className="rc-queue-item";
      const rm = Object.assign(document.createElement("button"), { className:"rc-btn", textContent:"Remove" });
      rm.onclick = ()=>{ state.queue = state.queue.filter(x=>x.id!==it.id); renderQueue(); };
      row.append(Object.assign(document.createElement("div"), { textContent: `${it.method||""} ${it.url||""}` }), rm);
      queueBody.append(row);
    }
  }

  function upsertRow(ev) {
    const merged = {
      rowKey: ev.rowKey || `${Date.now()}-${Math.random()}`,
      status: ev.status || (ev.ok ? "ok" : "error"),
      statusCode: ev.statusCode || "",
      roundtripTime: ev.roundtripTime || String(ev.RTT || ""),
      count: ev.count || 0,
      method: ev.method || "(agent)",
      url: ev.url || "",
      rawRequest: ev.rawRequest || ev.RawRequest || ev.RawRequestCombined || ev.RawRequestCOMBINED || ev.rawRequestCombined || ev.RawRequestCombined || ev.rawRequestCombined || "",
      rawResponse: ev.rawResponse || ev.RawResponse || ev.rawResponseText || ""
    };
    state.rows.unshift(merged);
  }

  let lastSelectedTr = null;
  async function onSelectRow(r, tr) {
    if (lastSelectedTr) lastSelectedTr.classList.remove("rc-row-active");
    tr.classList.add("rc-row-active"); lastSelectedTr = tr;
    reqPre.textContent = r.rawRequest || "(no RAW)";
    respPre.textContent = r.rawResponse || "(no RAW)";
  }

  function renderTable() {
    tableHost.innerHTML = "";
    const table = document.createElement("table"); table.className="rc-table";
    const thead = document.createElement("thead"); const trh = document.createElement("tr");
    for (const h of ["#", "Status", "Code", "RTT", "Count", "Pipelined", "Method", "URL"]) {
      const th = document.createElement("th"); th.textContent=h; th.style.textAlign="left"; th.style.position="sticky"; th.style.top="0"; th.style.background="#111827"; th.style.color="#e5e7eb"; trh.append(th);
    }
    thead.append(trh);
    const tbody = document.createElement("tbody");
    state.rows.forEach((r, i) => {
      const tr = document.createElement("tr");
      tr.onclick = ()=> onSelectRow(r, tr);
      tr.oncontextmenu = async (ev)=>{ ev.preventDefault(); const both = (r.rawRequest||"")+"\n\n"+(r.rawResponse||""); try { await navigator.clipboard.writeText(both); toast("Copied"); } catch(e){ toast("Copy failed: "+String(e),"error"); } };
      const vals = [String(i+1), r.status||"", r.statusCode||"", r.roundtripTime||"", String(r.count||""), String(r.pipelineDetected||""), r.method||"", r.url||""];
      vals.forEach((v, idx) => {
        const td = document.createElement("td");
        if (idx === 6) {
          const a = document.createElement("a"); a.href="#"; a.className="rc-url"; a.textContent=String(v||""); a.onclick=(e)=>{ e.preventDefault(); tr.click(); };
          td.append(a);
        } else td.textContent = String(v||"");
        tr.append(td);
      });
      tbody.append(tr);
    });
    table.append(thead, tbody); tableHost.append(table);
  }

  // Context menus (Replay + History)
  function ensureHostHeader(raw, host) {
    if (!host) return raw;
    if (/\nHost\s*:/i.test(raw) || /\r\nHost\s*:/i.test(raw)) return raw;
    const parts = raw.split(/\r?\n/);
    if (parts.length > 0) parts.splice(1, 0, `Host: ${host}`);
    let out = parts.join("\r\n");
    if (!out.endsWith("\r\n\r\n") && !out.endsWith("\n\n")) out += "\r\n\r\n";
    return out;
  }
  function enqueueFromContext(ctx) {
    try {
      const req = ctx && ctx.request; if (!req) return;
      const host = req.host || ""; const isTLS = !!req.isTls;
      const port = req.port || (isTLS?443:80); const path = (req.path || "/") + (req.query || "");
      const method = (req.raw ? (req.raw.split(" ")[0]) : "") || "GET";
      const url = `${isTLS?"https":"http"}://${host}:${port}${path}`;
      let raw = req.raw || `GET / HTTP/1.1\r\nHost: ${host}\r\n\r\n`; raw = ensureHostHeader(raw, host);
      const id = (typeof crypto!=="undefined" && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now()+Math.random());
      state.queue.push({ id, host, port, isTLS, sni: host, raw, method, url }); renderQueue();
    } catch (e) {
      try { upsertRow({ ok:false, status:"error", method:"(agent)", url:(t?"https":"http")+"://"+h+":"+p, rawRequest: payload, rawResponse: String(e) }); renderTable(); } catch(_){ }
 addLog("enqueueFromContext error: "+String(e)); }
  }
  sdk.commands.register("rc.enqueue.replay", { name:"Add to Race queue", group:"Race Condition", when:(ctx)=> (ctx && (ctx.type==="RequestContext"||ctx.type==="ResponseContext") && !!(ctx.request)), run:(ctx)=>enqueueFromContext(ctx) });
  sdk.menu.registerItem({ type: "Request",  commandId: "rc.enqueue.replay", leadingIcon: "fas fa-bolt", label: "Add to Race queue" });
  sdk.menu.registerItem({ type: "Response", commandId: "rc.enqueue.replay", leadingIcon: "fas fa-bolt", label: "Add to Race queue" });

  function extractIdsFromCtx(ctx) {
    const out = new Set();
    if (ctx && Array.isArray(ctx.requests)) for (const it of ctx.requests) { const id = it && (it.id || (it.request && it.request.id) || it.requestId); if (id) out.add(id); }
    const single = (ctx && ctx.request && (ctx.request.id || ctx.request.requestId)) || (ctx && ctx.row && ctx.row.id) || (ctx && ctx.id);
    if (single) out.add(single);
    return Array.from(out);
  }
  async function enqueueFromHistory(ctx) {
    const ids = extractIdsFromCtx(ctx||{});
    if (!ids.length) return;
    try {
      const itemsJson = await sdk.backend.histToQueue(JSON.stringify(ids));
      const items = JSON.parse(itemsJson||"[]");
      for (const it of items) {
        const id = it.id || (Date.now()+"-"+Math.random());
        state.queue.push({ id, host:it.host, port:it.port, isTLS:!!it.isTLS, sni:it.sni||it.host, raw:it.raw||"", method:it.method||"", url:it.url||"" });
      }
      renderQueue();
    } catch (e) {
      try { upsertRow({ ok:false, status:"error", method:"(agent)", url:(t?"https":"http")+"://"+h+":"+p, rawRequest: payload, rawResponse: String(e) }); renderTable(); } catch(_){ }
 addLog("enqueueFromHistory error: "+String(e)); }
  }
  sdk.commands.register("rc.enqueue.history", { name:"Add to Race queue", group:"Race Condition", when:(ctx)=> { try { return extractIdsFromCtx(ctx||{}).length>0; } catch { return false; } }, run:(ctx)=>enqueueFromHistory(ctx) });
  sdk.menu.registerItem({ type: "RequestRow", commandId: "rc.enqueue.history", leadingIcon: "fas fa-bolt", label: "Add to Race queue" });

  // Buttons
  const dbgPreRef = debugView.querySelector("pre"); // using existing dbgPre
  let evtSrc = null, sseErrors = 0;
  btnClear.onclick = ()=>{ state.queue = []; renderQueue(); };
  btnConnect.onclick = async ()=>{
    try {
      const res = await fetch(state.agentUrl + "/health", { method:"GET", mode:"cors" });
      const healthObj = await res.json();
      addLog("health: " + JSON.stringify(healthObj));
      toast(healthObj.ok ? "Agent OK" : "Agent not OK", healthObj.ok ? "success" : "error");
      if (healthObj.ok) { openLogsIfNeeded(); }
      showDebug();
    } catch (e) {
      addLog("health error: " + String(e));
      toast("Health failed", "error");
      showDebug();
    }
  };
  
  function openLogsIfNeeded(){
    if (evtSrc) return;
    try {
      evtSrc = new EventSource(state.agentUrl.replace(/\/+$/,"") + "/logs");
      let sseErrors = 0;
      evtSrc.onmessage = (ev)=> addLog(ev.data);
      evtSrc.onerror = (e)=> { sseErrors++; if (sseErrors<=5) addLog("sse error"); };
      addLog("SSE connected");
    } catch (e) {
      try { upsertRow({ ok:false, status:"error", method:"(agent)", url:(t?"https":"http")+"://"+h+":"+p, rawRequest: payload, rawResponse: String(e) }); renderTable(); } catch(_){ }
 addLog("logs error: "+String(e)); }
  }

  btnLogs.onclick = ()=>{
    if (evtSrc) { evtSrc.close(); evtSrc=null; toast("Logs stopped"); return; }
    try {
      evtSrc = new EventSource(state.agentUrl.replace(/\/+$/,"") + "/logs");
      evtSrc.onmessage = (ev)=> addLog(ev.data);
      evtSrc.onerror = (e)=> { sseErrors++; if (sseErrors<=5) addLog("sse error"); };
      toast("Logs streaming…");
      showDebug();
    } catch (e) {
      try { upsertRow({ ok:false, status:"error", method:"(agent)", url:(t?"https":"http")+"://"+h+":"+p, rawRequest: payload, rawResponse: String(e) }); renderTable(); } catch(_){ }
 addLog("logs error: "+String(e)); toast("Logs failed", "error"); showDebug(); }
  };
  btnRun.onclick = async ()=>{ openLogsIfNeeded(); addLog("btnRun clicked");
    if (state.queue.length < 2) { toast("Queue at least 2 requests", "warning"); return; }
    const [h,p,t] = [state.queue[0].host, state.queue[0].port, !!state.queue[0].isTLS];
    const same = state.queue.every(it => it.host===h && it.port===p && !!it.isTLS===t);
    if (!same) { toast("Same host:port:TLS required", "error"); return; }
    const payload = JSON.stringify({ target:{host:h,port:p,tls:t,sni:state.queue[0].sni||h}, requests: state.queue.map(q=>({raw:q.raw||""})), timeoutMs: 10000 });
    try {
      addLog("POST /run payload bytes: "+payload.length);
      const res = await fetch(state.agentUrl + "/run", { method:"POST", mode:"cors", headers:{ "Content-Type":"application/json" }, body: payload });
      addLog("POST /run status: "+res.status);
      const text = await res.text();
      addLog("POST /run body: "+text);
      const respObj = JSON.parse(text);
      respObj.url = (t?"https":"http")+"://"+h+":"+p;
      upsertRow(respObj); renderTable();
      if (!respObj.ok) { toast(respObj.message||"run failed","error"); showDebug(); }
    } catch (e) {
      try { upsertRow({ ok:false, status:"error", method:"(agent)", url:(t?"https":"http")+"://"+h+":"+p, rawRequest: payload, rawResponse: String(e) }); renderTable(); } catch(_){ }

      addLog("run error: " + String(e)); toast("Run failed (agent)", "error"); showDebug();
    }
  };
  btnRunPar.onclick = async ()=>{
    openLogsIfNeeded(); addLog("btnRunPar clicked");
    const timeoutMs = Math.max(1000, parseInt(iptTimeout.value||"15000",10)||15000);
    const retries = Math.max(0, parseInt(iptRetries.value||"2",10)||2);
    const [h,p,t] = [state.queue[0]?.host, state.queue[0]?.port, !!state.queue[0]?.isTLS];
    if (state.queue.length<2) { toast("Queue at least 2 requests", "warning"); return; }
    const same = state.queue.every(it => it.host===h && it.port===p && !!it.isTLS===t);
    if (!same) { toast("Same host:port:TLS required", "error"); return; }
    const payload = JSON.stringify({ target:{host:h,port:p,tls:t,sni:state.queue[0].sni||h}, requests: state.queue.map(q=>({raw:q.raw||""})), timeoutMs: timeoutMs });
    async function fetchWithTimeout(url, opts, ms){
      const ctrl = new AbortController();
      const t = setTimeout(()=>ctrl.abort("client-timeout"), ms);
      try { const res = await fetch(url, { ...opts, signal: ctrl.signal }); clearTimeout(t); return res; }
      catch(e){ clearTimeout(t); throw e; }
    }
    let res=null, text="";
    for (let attempt=0; attempt<=retries; attempt++) {
      try {
        res = await fetchWithTimeout(state.agentUrl + "/run_parallel", { method:"POST", mode:"cors", headers:{ "Content-Type":"application/json" }, body: payload }, timeoutMs);
        addLog("POST /run_parallel status: " + res.status + " (attempt " + (attempt+1) + "/" + (retries+1) + ")");
        text = await res.text(); break;
      } catch(e) {
        addLog("POST /run_parallel error: " + String(e) + " (attempt " + (attempt+1) + "/" + (retries+1) + ")");
        if (attempt===retries) { addLog("parallel failed"); toast("Parallel run failed","error"); return; }
      }
    }
    try {
      const obj = JSON.parse(text||"{}");
      if (!obj || !obj.results) { toast("Bad parallel response", "error"); addLog("parallel body: "+text); return; }
      // Append one row per request
      (obj.results||[]).forEach((r,i)=>{
        upsertRow({ ok: r.ok, status: r.ok?"ok":"error", statusCode: (r.statusLine||"").split(" ")[1]||"", roundtripTime: String(r.rtt||""), count: 1, method: "(agent-par)", url: (t?"https":"http")+"://"+h+":"+p, rawRequest: r.rawRequest||"", rawResponse: r.rawResponse||"" });
      });
      renderTable();
      toast("Parallel run done: "+(obj.results||[]).length+" requests","success");
    } catch(e) {
      addLog("parallel parse error: "+String(e));
      toast("Parallel parse error","error");
    }
  };


  // Initial paints
  runnerView.append(topBar);
  runnerView.append(queueCard);
  runnerView.append(resultsCard);
  renderQueue(); renderTable();

  // renderTable defined after elements:
  function renderTable() {
    tableHost.innerHTML = "";
    const table = document.createElement("table"); table.className="rc-table";
    const thead = document.createElement("thead"); const trh = document.createElement("tr");
    for (const h of ["#", "Status", "Code", "RTT", "Count", "Pipelined", "Method", "URL"]) {
      const th = document.createElement("th"); th.textContent=h; th.style.textAlign="left"; th.style.position="sticky"; th.style.top="0"; th.style.background="#111827"; th.style.color="#e5e7eb"; trh.append(th);
    }
    thead.append(trh);
    const tbody = document.createElement("tbody");
    state.rows.forEach((r, i) => {
      const tr = document.createElement("tr");
      tr.onclick = ()=> { reqPre.textContent = r.rawRequest || "(no RAW)"; respPre.textContent = r.rawResponse || "(no RAW)"; tr.classList.add("rc-row-active"); };
      tr.oncontextmenu = async (ev)=>{ ev.preventDefault(); const both = (r.rawRequest||"")+"\n\n"+(r.rawResponse||""); try { await navigator.clipboard.writeText(both); toast("Copied"); } catch(e){ toast("Copy failed: "+String(e),"error"); } };
      const vals = [String(i+1), r.status||"", r.statusCode||"", r.roundtripTime||"", String(r.count||""), String(r.pipelineDetected||""), r.method||"", r.url||""];
      vals.forEach((v, idx) => {
        const td = document.createElement("td");
        if (idx === 6) {
          const a = document.createElement("a"); a.href="#"; a.className="rc-url"; a.textContent=String(v||""); a.onclick=(e)=>{ e.preventDefault(); tr.click(); };
          td.append(a);
        } else td.textContent = String(v||"");
        tr.append(td);
      });
      tbody.append(tr);
    });
    table.append(thead, tbody); tableHost.append(table);
  }
}
