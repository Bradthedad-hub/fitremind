// FitRemind v4 – unterstützt Wochentage oder Intervall (alle N Tage)
const $ = (sel)=>document.querySelector(sel);
const listEl = $("#list");
let deferredPrompt = null;
let editIdx = null;

// Storage-Keys
const KEY = "fitremind:v4";
function load(){ try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch(e){ return []; } }
function save(d){ localStorage.setItem(KEY, JSON.stringify(d)); }

// Formular dynamisch einsetzen
document.getElementById("form-container").innerHTML = `
  <div class="row">
    <div>
      <label for="name">Name der Übung</label>
      <input id="name" placeholder="z.B. Planks, Dehnen">
    </div>
    <div>
      <label for="time">Uhrzeit</label>
      <input id="time" type="time" value="08:00">
    </div>
  </div>
  <div class="row-3" style="margin-top:10px">
    <div><label for="duration">Dauer (Min.)</label><input id="duration" type="number" value="10"></div>
    <div><label for="sets">Sätze</label><input id="sets" type="number" value="3"></div>
    <div><label for="reps">Wiederholungen</label><input id="reps" type="number" value="10"></div>
  </div>
  <div class="row" style="margin-top:10px">
    <div>
      <label for="recurrence">Wiederholung</label>
      <select id="recurrence">
        <option value="weekly">An bestimmten Wochentagen</option>
        <option value="interval">Alle N Tage</option>
      </select>
    </div>
    <div id="intervalBox" class="hidden">
      <label for="intervalDays">Intervall (Tage)</label>
      <input id="intervalDays" type="number" min="1" value="2">
    </div>
  </div>
  <div id="weekdayBox" style="margin-top:10px">
    <label>Wochentage</label>
    <div class="actions">
      <label><input type="checkbox" class="weekday" value="MO"> Mo</label>
      <label><input type="checkbox" class="weekday" value="TU"> Di</label>
      <label><input type="checkbox" class="weekday" value="WE"> Mi</label>
      <label><input type="checkbox" class="weekday" value="TH"> Do</label>
      <label><input type="checkbox" class="weekday" value="FR"> Fr</label>
      <label><input type="checkbox" class="weekday" value="SA"> Sa</label>
      <label><input type="checkbox" class="weekday" value="SU"> So</label>
    </div>
  </div>
  <div class="footer">
    <button id="add">➕ Speichern</button>
    <button id="cancelEdit" class="secondary hidden">✖️ Abbrechen</button>
  </div>
`;

// Recurrence-Umschalten
const recurrenceSel = $("#recurrence");
const weekdayBox = $("#weekdayBox");
const intervalBox = $("#intervalBox");
function toggleRecurrenceUI(){
  if(recurrenceSel.value === "weekly"){ weekdayBox.classList.remove("hidden"); intervalBox.classList.add("hidden"); }
  else { weekdayBox.classList.add("hidden"); intervalBox.classList.remove("hidden"); }
}
recurrenceSel.addEventListener("change", toggleRecurrenceUI);
toggleRecurrenceUI();

// Helfer
function getCheckedDays(){ return [...document.querySelectorAll(".weekday:checked")].map(cb=>cb.value); }
function setCheckedDays(days){ document.querySelectorAll(".weekday").forEach(cb=>cb.checked=days.includes(cb.value)); }

function clearForm(){
  $("#name").value=""; $("#time").value="08:00"; $("#duration").value="10";
  $("#sets").value="3"; $("#reps").value="10"; $("#intervalDays").value="2";
  setCheckedDays([]); editIdx=null;
  $("#add").textContent="➕ Speichern"; $("#cancelEdit").classList.add("hidden");
}

function render(){
  const data=load();
  listEl.innerHTML="";
  if(!data.length){ listEl.innerHTML="<p class='muted'>Noch keine Übungen.</p>"; return; }
  data.forEach((ex,idx)=>{
    const div=document.createElement("div");
    div.className="item";
    div.innerHTML=`
      <div style="flex:1">
        <h3>${ex.name}</h3>
        <div class="muted">${ex.recurrence==="interval"?"alle "+ex.intervalDays+" Tage":(ex.days||[]).join(", ")} · ${ex.time}</div>
      </div>
      <div class="actions">
        <button data-act="edit" data-idx="${idx}" class="success">✏️</button>
        <button data-act="delete" data-idx="${idx}" class="danger">🗑️</button>
      </div>`;
    listEl.appendChild(div);
  });
}

// Aktionen
$("#add").addEventListener("click",()=>{
  const rec=recurrenceSel.value;
  const record={
    name:$("#name").value,
    time:$("#time").value,
    duration:$("#duration").value,
    sets:$("#sets").value,
    reps:$("#reps").value,
    recurrence:rec,
    days: rec==="weekly"?getCheckedDays():[],
    intervalDays: rec==="interval"?$("#intervalDays").value:undefined
  };
  const data=load();
  if(editIdx===null) data.push(record); else data[editIdx]=record;
  save(data); render(); clearForm();
});
$("#cancelEdit").addEventListener("click",clearForm);

listEl.addEventListener("click",e=>{
  const btn=e.target.closest("button"); if(!btn) return;
  const idx=Number(btn.dataset.idx); const data=load();
  if(btn.dataset.act==="delete"){ data.splice(idx,1); save(data); render(); }
  if(btn.dataset.act==="edit"){ editIdx=idx; const ex=data[idx];
    $("#name").value=ex.name; $("#time").value=ex.time; $("#duration").value=ex.duration;
    $("#sets").value=ex.sets; $("#reps").value=ex.reps; $("#recurrence").value=ex.recurrence;
    if(ex.recurrence==="weekly") setCheckedDays(ex.days); else $("#intervalDays").value=ex.intervalDays;
    toggleRecurrenceUI();
    $("#add").textContent="💾 Ändern"; $("#cancelEdit").classList.remove("hidden");
  }
});

render();
