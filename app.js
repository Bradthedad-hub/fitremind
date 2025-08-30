// --- Probe: läuft mein JS? ---
document.body.insertAdjacentHTML(
  'afterbegin',
  '<div id="fit-debug" style="position:fixed;right:8px;bottom:8px;background:#ff0;padding:6px 8px;border:1px solid #000;z-index:9999">JS läuft</div>'
);
setTimeout(()=> document.getElementById('fit-debug')?.remove(), 4000);

// FitRemind v4 – komplette Logik
// Theme/Font, Wiederholungen, CSV/ICS, YouTube, Kurz-Notiz,
// NEU: Ausführliche Beschreibung (ein-/ausklappbar)

const $ = (sel)=>document.querySelector(sel);
const listEl = $("#list");
let deferredPrompt = null;
let editIdx = null;

// ---------- Storage ----------
const KEY = "fitremind:v4";
const UIKEY = "fitremind:ui:v4";

function load(){ try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch(e){ return []; } }
function save(d){ localStorage.setItem(KEY, JSON.stringify(d)); }
function loadUI(){ try { return JSON.parse(localStorage.getItem(UIKEY)) || {}; } catch(e){ return {}; } }
function saveUI(u){ localStorage.setItem(UIKEY, JSON.stringify(u)); }

// ---------- UI: Theme & Schrift ----------
function applyUI(){
  const ui = loadUI();
  const theme = ui.theme || "dark";
  document.documentElement.setAttribute("data-theme", theme);
  const font = ui.fontscale || "1";
  document.documentElement.style.setProperty("--fontscale", font);
  document.documentElement.setAttribute("data-fontscale", font);
  const thSel = $("#themeSelect"), ftSel = $("#fontSelect");
  if (thSel) thSel.value = theme;
  if (ftSel) ftSel.value = font;
  if (ui.displayName){
    $("#app-title").innerHTML = `💪 ${ui.displayName} <span class="chip">PWA</span>`;
    document.title = ui.displayName + " – Übungen & Erinnerungen";
  }
  if (ui.iconDataUrl){
    const ico = $("#app-favicon");
    if (ico) ico.href = ui.iconDataUrl;
    const prev = $("#iconPreview");
    if (prev) prev.src = ui.iconDataUrl;
  }
}
applyUI();

$("#themeSelect")?.addEventListener("change", (e)=>{ const ui=loadUI(); ui.theme=e.target.value; saveUI(ui); applyUI(); });
$("#fontSelect")?.addEventListener("change", (e)=>{ const ui=loadUI(); ui.fontscale=e.target.value; saveUI(ui); applyUI(); });

// ---------- Formular-Grundbefüllung ----------
const tzSelect = $("#timezone");
const tzs = (Intl.supportedValuesOf ? Intl.supportedValuesOf("timeZone") : ["Europe/Berlin"]);
tzs.forEach(tz=>{ const o=document.createElement("option"); o.value=tz;o.textContent=tz; tzSelect?.appendChild(o); });
try { if (tzSelect) tzSelect.value = Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Berlin"; } catch(e){ if (tzSelect) tzSelect.value = "Europe/Berlin"; }

const startdate = $("#startdate");
if (startdate) startdate.valueAsDate = new Date();

// Recurrence UI toggle
const recurrenceSel = $("#recurrence");
const weekdayBox = $("#weekdayBox");
const intervalBox = $("#intervalBox");
function toggleRecurrenceUI(){
  const mode = recurrenceSel?.value || "weekly";
  if(mode === "weekly"){ weekdayBox?.classList.remove("hidden"); intervalBox?.classList.add("hidden"); }
  else { weekdayBox?.classList.add("hidden"); intervalBox?.classList.remove("hidden"); }
}
recurrenceSel?.addEventListener("change", toggleRecurrenceUI);
toggleRecurrenceUI();

// Hilfsfunktionen
function getCheckedDays(){ return [...document.querySelectorAll(".weekday:checked")].map(cb=>cb.value); }
function setCheckedDays(days){ document.querySelectorAll(".weekday").forEach(cb=>{ cb.checked = !!(days?.includes(cb.value)); }); }

function clearForm(){
  $("#name").value=""; $("#time").value="08:00"; $("#duration").value="10";
  $("#sets").value="3"; $("#reps").value="10";
  $("#pain").value="0"; const pv = document.getElementById("painVal"); if (pv) pv.textContent="0";
  $("#yt").value=""; $("#notes").value="";
  $("#longNotes")?.value="";
  setCheckedDays([]);
  if (startdate) startdate.valueAsDate = new Date();
  if (recurrenceSel){ recurrenceSel.value = "weekly"; }
  $("#intervalDays").value="2"; toggleRecurrenceUI();
  editIdx = null;
  $("#add").textContent = "➕ Übung speichern";
  $("#cancelEdit")?.classList.add("hidden");
}

function escHtml(s){ return String(s).replace(/[&<>"]/g, m=>({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;" }[m])); }
function nl2br(s){ return escHtml(s).replace(/\n/g,"<br>"); }

// ---------- Render-Liste ----------
function render(){
  const data = load();
  listEl.innerHTML = "";
  if(!data.length){
    listEl.innerHTML = "<p class='muted'>Noch keine Übungen angelegt.</p>";
    return;
  }
  data.forEach((it, idx)=>{
    const details = [];
    if(it.sets) details.push(`${it.sets}×Sätze`);
    if(it.reps) details.push(`${it.reps}×Whd`);
    if(it.pain !== undefined) details.push(`Schmerz ${it.pain}/10`);
    const recur = (it.recurrence==="interval") ? `alle ${it.intervalDays||1} Tage` : ((it.days||[]).join(",") || "—");

    const item = document.createElement("div");
    item.className = "item";
    item.innerHTML = `
      <div style="flex:1;min-width:260px">
        <h3>${escHtml(it.name||"")}</h3>
        <div class="muted">${recur} · ${escHtml(it.time||"")} · ${escHtml(it.tz||"")}${details.length? " · " + details.join(" · ") : ""}</div>
        ${it.notes ? `<div class="muted">Notiz: ${escHtml(it.notes)}</div>` : ""}
        ${it.yt ? `<div><a href="${escHtml(it.yt)}" target="_blank" rel="noopener">▶️ Video ansehen</a></div>` : ""}
        ${it.longNotes ? `
          <div style="margin-top:8px">
            <button class="secondary" data-act="toggleLong" data-idx="${idx}">📑 Beschreibung anzeigen</button>
            <div class="muted" id="long-${idx}" style="display:none; margin-top:8px; line-height:1.4">${nl2br(it.longNotes)}</div>
          </div>` : ""}
      </div>
      <div class="actions">
        <button data-act="edit" data-idx="${idx}" class="success">✏️ Bearbeiten</button>
        <button data-act="ics" data-idx="${idx}" class="secondary">📆 .ics</button>
        <button data-act="toggle" data-idx="${idx}" class="${it.active? 'success':'secondary'}">${it.active?'Aktiv':'Inaktiv'}</button>
        <button data-act="delete" data-idx="${idx}" class="danger">Löschen</button>
      </div>
    `;
    listEl.appendChild(item);
  });
}
render();

// ---------- ICS/CSV ----------
function byDayToRRule(days){ return days && days.length ? "BYDAY=" + days.join(",") : ""; }
function toICS(ex){
  const [hh, mm] = (ex.time||"08:00").split(":").map(Number);
  const dt = new Date(ex.start || new Date()); dt.setHours(hh||8, mm||0, 0, 0);
  function fmtLocal(d){ const y=d.getFullYear(); const m=String(d.getMonth()+1).padStart(2,"0"); const da=String(d.getDate()).padStart(2,"0"); const h=String(d.getHours()).padStart(2,"0"); const mi=String(d.getMinutes()).padStart(2,"0"); return `${y}${m}${da}T${h}${mi}00`; }
  const uid = (crypto?.randomUUID ? crypto.randomUUID() : String(Date.now())) + "@fitremind";
  let rrule = "";
  if(ex.recurrence === "interval"){
    const iv = Math.max(1, Number(ex.intervalDays)||1);
    rrule = `FREQ=DAILY;INTERVAL=${iv}`;
  } else {
    const byday = byDayToRRule(ex.days);
    rrule = `FREQ=WEEKLY;${byday}`;
  }
  const extra = [];
  if(ex.sets) extra.push(`${ex.sets} Sätze`);
  if(ex.reps) extra.push(`${ex.reps} Wiederholungen`);
  if(ex.pain!==undefined) extra.push(`Schmerz: ${ex.pain}/10`);
  if(ex.longNotes) extra.push(`Beschreibung: ${ex.longNotes.replace(/\r?\n/g," ")}`);
  const desc = (ex.notes||"") + (ex.yt? "\\nVideo: " + ex.yt : "") + (extra.length? "\\n" + extra.join(" · ") : "");

  return `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//FitRemind//PWA//DE
BEGIN:VEVENT
UID:${uid}
DTSTAMP:${fmtLocal(new Date())}Z
DTSTART;TZID=${ex.tz||"Europe/Berlin"}:${fmtLocal(dt)}
DURATION:PT${Math.max(1, Number(ex.duration)||10)}M
RRULE:${rrule}
SUMMARY:${ex.name||"Übung"}
DESCRIPTION:${desc.replace(/\n/g,"\\n")}
END:VEVENT
END:VCALENDAR`.replace(/\n/g,"\r\n");
}

function download(name, content, type){
  const blob = new Blob([content], {type});
  const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download=name; a.click(); URL.revokeObjectURL(a.href);
}

// ---------- Buttons oben/unten ----------
$("#enableNotify")?.addEventListener("click", ensurePermission);
$("#testNotify")?.addEventListener("click", async ()=>{
  if(!(await ensurePermission())) return;
  new Notification("FitRemind", { body: "Test – Benachrichtigungen funktionieren!", tag:"fitremind-test" });
});

$("#exportAll")?.addEventListener("click", ()=>{
  const data=load(); if(!data.length){ alert("Keine Übungen vorhanden."); return; }
  const parts=data.map(toICS).join("\n");
  download("FitRemind_alle.ics", parts, "text/calendar");
});

$("#exportCSV")?.addEventListener("click", ()=>{
  const data=load(); if(!data.length){ alert("Keine Übungen vorhanden."); return; }
  const header = ["Name","Uhrzeit","Dauer_Min","Zeitzone","Startdatum_ISO","Wiederholung","Wochentage","Intervall_Tage","Sätze","Wiederholungen","Schmerz_0_10","YouTube","Kurz_Notiz","Ausführliche_Beschreibung","Aktiv"];
  const lines = [header.join(",")];
  const esc = (v)=>('"' + String(v).replace(/"/g,'""') + '"');
  data.forEach(r=>{
    lines.push([
      r.name, r.time, r.duration||"", r.tz||"", r.start||"",
      r.recurrence, (r.days||[]).join("|"), r.intervalDays||"",
      r.sets||"", r.reps||"", (r.pain===0||r.pain? r.pain:""),
      r.yt||"", r.notes||"", (r.longNotes||"").replace(/\r?\n/g," "),
      r.active?"ja":"nein"
    ].map(esc).join(","));
  });
  download("FitRemind_Uebungen.csv", lines.join("\r\n"), "text/csv");
});

$("#clear")?.addEventListener("click", ()=>{
  if(confirm("Wirklich alle Übungen löschen?")){
    localStorage.removeItem(KEY);
    render(); clearForm();
  }
});

// ---------- Add/Save ----------
$("#add")?.addEventListener("click", ()=>{
  const name = $("#name").value.trim();
  const time = $("#time").value;
  const duration = $("#duration").value;
  const tz = $("#timezone")?.value || "Europe/Berlin";
  const start = startdate?.valueAsDate || new Date();
  const notes = $("#notes")?.value.trim() || "";
  const yt = $("#yt")?.value.trim() || "";
  const sets = Number($("#sets").value)||null;
  const reps = Number($("#reps").value)||null;
  const pain = Number($("#pain").value);
  const recurrence = recurrenceSel?.value || "weekly";
  let days = [], intervalDays = null;
  if(recurrence === "interval"){
    intervalDays = Math.max(1, Number($("#intervalDays").value)||1);
  } else {
    days = getCheckedDays();
  }
  const longNotes = $("#longNotes")?.value || "";

  if(!name || !time || (recurrence==="weekly" && !days.length)){
    alert("Bitte Name, Uhrzeit und Wiederholung (Wochentage oder Intervall) angeben.");
    return;
  }

  const data = load();
  const record = {
    name, time, duration, tz, start: start.toISOString(),
    notes, yt, sets, reps, pain,
    recurrence, days, intervalDays,
    longNotes,
    active: true
  };
  if(editIdx===null){ data.push(record); } else { record.active = data[editIdx].active; data[editIdx] = record; }
  save(data); render(); scheduleTick(); clearForm();
});

$("#cancelEdit")?.addEventListener("click", clearForm);

// ---------- List-Events ----------
listEl.addEventListener("click",(e)=>{
  const btn=e.target.closest("button"); if(!btn) return;
  const idx=Number(btn.dataset.idx);
  const data=load(); const ex=data[idx]; if(!ex) return;
  const act=btn.dataset.act;

  if(act==="delete"){
    if(confirm("Diese Übung löschen?")){
      data.splice(idx,1); save(data); render(); if(editIdx===idx) clearForm();
    }
  } else if(act==="toggle"){
    ex.active=!ex.active; save(data); render();
  } else if(act==="ics"){
    const ics = toICS(ex); download(`${(ex.name||"uebung").replace(/\s+/g,"_")}.ics`, ics, "text/calendar");
  } else if(act==="edit"){
    editIdx = idx;
    $("#name").value=ex.name||""; $("#time").value=ex.time||"08:00"; $("#duration").value=ex.duration||"10";
    $("#sets").value=ex.sets||""; $("#reps").value=ex.reps||"";
    $("#pain").value=(ex.pain!==undefined? ex.pain:0); const pv = document.getElementById("painVal"); if (pv) pv.textContent=$("#pain").value;
    $("#timezone").value=ex.tz||$("#timezone").value;
    const d = new Date(ex.start||new Date()); if (startdate) startdate.valueAsDate = d;
    recurrenceSel.value = ex.recurrence || "weekly";
    $("#intervalDays").value = ex.intervalDays || 2;
    toggleRecurrenceUI();
    setCheckedDays(ex.days||[]);
    $("#notes").value=ex.notes||""; $("#yt").value=ex.yt||"";
    $("#longNotes").value=ex.longNotes||"";
    $("#add").textContent = "💾 Änderungen speichern";
    $("#cancelEdit")?.classList.remove("hidden");
    window.scrollTo({top:0, behavior:"smooth"});
  } else if(act==="toggleLong"){
    const box = document.getElementById(`long-${idx}`);
    if(!box) return;
    const visible = box.style.display !== "none";
    box.style.display = visible ? "none" : "block";
    btn.textContent = visible ? "📑 Beschreibung anzeigen" : "📕 Beschreibung verbergen";
  }
});

// ---------- Notifications & Scheduler ----------
async function ensurePermission(){
  if(!("Notification" in window)) { alert("Dieser Browser unterstützt keine Benachrichtigungen."); return false; }
  let perm = Notification.permission;
  if(perm === "default"){ perm = await Notification.requestPermission(); }
  if(perm !== "granted"){ alert("Benachrichtigungen sind nicht erlaubt."); return false; }
  return true;
}

function weekdayCode(d){ return ["SU","MO","TU","WE","TH","FR","SA"][d.getDay()]; }
function timeMatches(now, ex){
  const [hh, mm] = (ex.time||"08:00").split(":").map(Number);
  const local = new Date(now.toLocaleString("en-US", {timeZone: ex.tz||"Europe/Berlin"}));
  return local.getHours()===(hh||8) && local.getMinutes()===(mm||0);
}
function isDueToday(now, ex){
  const localNow = new Date(now.toLocaleString("en-US", {timeZone: ex.tz||"Europe/Berlin"}));
  const start = new Date(new Date(ex.start||new Date()).toLocaleString("en-US", {timeZone: ex.tz||"Europe/Berlin"}));
  const toMid = (d)=>{ const x=new Date(d); x.setHours(0,0,0,0); return x; };
  const dNow = toMid(localNow), dStart = toMid(start);
  if(dNow < dStart) return false;
  if(ex.recurrence === "interval"){
    const diffDays = Math.round((dNow - dStart) / 86400000);
    const iv =
