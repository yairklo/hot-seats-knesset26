// Hot seats viewer. Definitions (unchanged from the earlier tool):
//   inside the line  = list positions 1..N
//   hot range        = positions N-2..N+2 (±1 is N-1..N+1)
//   safe ("בפנים")   = positions 1..N-3
const OUTLETS={"Channel 13":"חדשות 13","Channel 12":"חדשות 12","Israel Hayom":"ישראל היום","Channel 14":"ערוץ 14","Zman Yisrael":"זמן ישראל","Maariv":"מעריב","i24":"i24NEWS","Channel 16":"ערוץ 16","Walla":"וואלה","Kan 11":"כאן 11"};
const G_LABEL={F:"אישה",M:"גבר",U:"מגדר לא אומת"};
const state={src:"avg",g:"all"};
let LISTS={},SOURCES=[],POLLS=[],WARN_STATIC=[],DETAILS={};
const $=id=>document.getElementById(id);
const esc=s=>String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const fmtDate=d=>{const [y,m,dd]=d.split("-");return `${+dd}.${+m}.${y.slice(2)}`};

function displayName(c){
  if(c.display)return c.display;
  const t=c.official.split(" ");
  return t.length===2?`${t[1]} ${t[0]}`:c.official;
}
function genderOf(c){return c.gender==="F"||c.gender==="M"?c.gender:"U"}

async function load(){
  try{
    // candidate-details.json is optional: without it the page works, just without detail cards' content.
    const details=fetch("candidate-details.json").then(r=>r.ok?r.json():{}).catch(()=>({}));
    const [p,c,d]=await Promise.all([fetch("polls.json").then(r=>{if(!r.ok)throw r;return r.json()}),fetch("candidates.json").then(r=>{if(!r.ok)throw r;return r.json()}),details]);
    DETAILS=d&&typeof d==="object"?d:{};
    init(p,c);
  }catch(e){
    const box=$("loadErr");box.hidden=false;
    box.innerHTML=`לא הצלחתי לטעון את קובצי הנתונים (polls.json, candidates.json). הדפדפן חוסם טעינת קבצים כשפותחים את הדף ישירות מהדיסק, לכן צריך להריץ שרת מקומי מתוך התיקייה:<br><code>python -m http.server 8766</code><br>ואז לפתוח <code>http://localhost:8766</code>.`;
  }
}

function init(pollData,candData){
  candData.parties.forEach(p=>{LISTS[p.name]=p.candidates});
  const map=pollData.partyMap||{};
  WARN_STATIC=[];
  Object.entries(map).forEach(([en,he])=>{if(!LISTS[he])WARN_STATIC.push(`המפלגה "${en}" ממופה ל"${he}", אבל אין רשימת מועמדים בשם הזה בנתונים.`)});
  POLLS=pollData.polls.map((pl,i)=>{
    const seats={};
    Object.entries(pl.seats).forEach(([en,v])=>{
      const he=map[en];
      if(!he){WARN_STATIC.push(`בסקר ${OUTLETS[pl.outlet]||pl.outlet} (${fmtDate(pl.date)}) יש מפלגה בשם "${en}" שאין לה מיפוי לשם בעברית. היא לא מוצגת.`);return}
      seats[he]=typeof v==="number"?v:0;
    });
    return {id:"p"+i,label:`${OUTLETS[pl.outlet]||pl.outlet} · ${fmtDate(pl.date)}`,short:OUTLETS[pl.outlet]||pl.outlet,date:fmtDate(pl.date),seats,exact:null};
  });
  const parties=[...new Set(Object.values(map))];
  const avgExact={},avgSeats={};
  parties.forEach(he=>{const s=POLLS.reduce((a,p)=>a+(p.seats[he]||0),0);avgExact[he]=s/POLLS.length});
  // Parties whose rounded average is below 4 count as below the threshold (0 seats).
  // The rest share exactly 120 seats by the largest-remainder method on their averages.
  const passing=parties.filter(he=>Math.round(avgExact[he])>=4);
  parties.forEach(he=>{avgSeats[he]=0});
  const total=passing.reduce((a,he)=>a+avgExact[he],0);
  if(total>0){
    const quota=Object.fromEntries(passing.map(he=>[he,avgExact[he]*120/total]));
    passing.forEach(he=>{avgSeats[he]=Math.floor(quota[he])});
    let left=120-passing.reduce((a,he)=>a+avgSeats[he],0);
    [...passing].sort((a,b)=>(quota[b]-Math.floor(quota[b]))-(quota[a]-Math.floor(quota[a]))).slice(0,left).forEach(he=>{avgSeats[he]++});
  }
  SOURCES=[{id:"avg",label:`ממוצע הסקרים (${POLLS.length} סקרים)`,short:"ממוצע",seats:avgSeats,exact:avgExact},...POLLS];
  $("src").innerHTML=SOURCES.map(s=>`<option value="${s.id}">${esc(s.label)}</option>`).join("");
  $("src").value=state.src;
  $("src").addEventListener("change",e=>{state.src=e.target.value;render()});
  document.querySelectorAll(".seg button").forEach(b=>b.addEventListener("click",()=>{
    state.g=b.dataset.g;document.querySelectorAll(".seg button").forEach(x=>x.setAttribute("aria-pressed",x===b));render();
  }));
  document.querySelectorAll("button.exp").forEach(b=>b.addEventListener("click",()=>exportPng(b)));
  render();
}

function partyRows(src){
  return Object.entries(src.seats).filter(([,n])=>n>0).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0],"he"));
}
function analyse(party,N){
  const list=LISTS[party]||[];
  const byPos=Object.fromEntries(list.map(c=>[c.pos,c]));
  const cnt=()=>({F:0,M:0,U:0,missing:0});
  const line=cnt(),hot=cnt(),hotRows=[];
  for(let pos=1;pos<=N;pos++){const c=byPos[pos];if(!c)line.missing++;else line[genderOf(c)]++}
  for(let pos=Math.max(1,N-2);pos<=N+2;pos++){
    const c=byPos[pos];
    if(!c){hot.missing++;hotRows.push({pos,missing:true});continue}
    hot[genderOf(c)]++;hotRows.push({pos,c,g:genderOf(c),inside:pos<=N,e1:Math.abs(pos-N)<=1});
  }
  return {line,hot,hotRows,hasList:!!LISTS[party],listLen:list.length};
}
const gMatch=g=>state.g==="all"||state.g===g;
const cntHtml=c=>`<span class="cf">${c.F} נשים</span> · <span class="cm">${c.M} גברים</span>${c.U?` · <span class="cu">${c.U} לא אומת</span>`:""}${c.missing?` · <span class="cu">${c.missing} חסרים</span>`:""}`;
const filterLabel=()=>state.g==="F"?"נשים בלבד":state.g==="M"?"גברים בלבד":"כל המועמדים";

function render(){
  const src=SOURCES.find(s=>s.id===state.src);
  const rows=partyRows(src);
  const warns=[...WARN_STATIC];
  const T={line:{F:0,M:0,U:0,missing:0},hot:{F:0,M:0,U:0,missing:0}};
  const cards=rows.map(([party,N])=>{
    const a=analyse(party,N);
    if(!a.hasList){warns.push(`אין רשימת מועמדים למפלגה "${party}".`);return ""}
    ["line","hot"].forEach(k=>["F","M","U","missing"].forEach(x=>T[k][x]+=a[k][x]));
    if(a.line.missing||a.hot.missing)warns.push(`${party}: ב${src.short} יש ${N} מנדטים, כך שהטווח החם מגיע עד מקום ${N+2}, אבל בנתונים יש רק ${a.listLen} מקומות. המקומות החסרים מסומנים "אין נתונים" ולא נספרים.`);
    a.hotRows.filter(r=>r.g==="U").forEach(r=>warns.push(`${party}, מקום ${r.pos} (${displayName(r.c)}): המגדר לא אומת, ולכן לא נספר כאישה או כגבר.`));
    let body="";
    a.hotRows.forEach(r=>{
      if(r.missing){body+=`<div class="missing">מקום ${r.pos}: אין נתונים</div>`}
      else if(gMatch(r.g)){
        body+=`<div class="cand${r.e1?" e1":""}"><span class="pos">${r.pos}</span><span><button type="button" class="cname" data-key="${esc(party+"|"+r.pos)}">${esc(displayName(r.c))}</button></span><span class="tag ${r.g}">${G_LABEL[r.g]}</span><span class="st ${r.inside?"in":"out"}">${r.inside?"נכנס":"לא נכנס"}</span></div>`;
      }
      if(r.pos===N)body+=`<div class="cutline">קו המנדטים · ${N}</div>`;
    });
    const exact=src.exact?`<span class="exact">(ממוצע ${src.exact[party].toFixed(1)})</span>`:"";
    return `<article class="card"><h3><span>${esc(party)}${N<6?"*":""}</span><span><span class="seats">${N}</span>${exact}</span></h3>
      <div class="counts"><span class="k">בתוך הקו (1–${N}):</span><span>${cntHtml(a.line)}</span><span class="k">בטווח החם (${Math.max(1,N-2)}–${N+2}):</span><span>${cntHtml(a.hot)}</span></div>
      ${body}</article>`;
  }).join("");
  const below=Object.entries(src.seats).filter(([,n])=>!(n>0)).map(([p])=>p+(src.exact&&src.exact[p]>0?` (ממוצע ${src.exact[p].toFixed(1)})`:""));
  $("capParties").innerHTML=`
    <div class="foot" style="margin:0 0 10px;font-size:13px;color:var(--ink2)">${esc(src.label)} · ${filterLabel()}</div>
    <div class="totals">
      <div class="tot"><div class="lbl">סה"כ בתוך הקו</div><div class="nums"><span class="cf"><b>${T.line.F}</b> נשים</span><span class="cm"><b>${T.line.M}</b> גברים</span>${T.line.U?`<span class="cu"><b>${T.line.U}</b> לא אומת</span>`:""}</div></div>
      <div class="tot"><div class="lbl">סה"כ בטווח החם (2± מנדטים)</div><div class="nums"><span class="cf"><b>${T.hot.F}</b> נשים</span><span class="cm"><b>${T.hot.M}</b> גברים</span>${T.hot.U?`<span class="cu"><b>${T.hot.U}</b> לא אומת</span>`:""}</div></div>
    </div>
    <div class="legend"><span><i class="sw" style="background:#FBF7EE;border:1px solid #EFE3C8"></i>טווח 1±</span><span><i class="sw" style="background:var(--inbg)"></i>נכנס (מעל הקו)</span><span><i class="sw" style="background:var(--outbg)"></i>לא נכנס (מתחת לקו)</span><span>* מתחת ל-6 מנדטים, קרוב לאחוז החסימה</span></div>
    <div class="cards">${cards}</div>
    ${below.length?`<div class="below">מתחת לאחוז החסימה במקור הזה: ${below.map(esc).join(", ")}</div>`:""}
    ${src.exact?`<div class="foot">בממוצע, סקר שבו מפלגה מתחת לאחוז החסימה נספר כ-0. מפלגה שהממוצע המעוגל שלה נמוך מ-4 מוצגת כמתחת לאחוז החסימה. בין שאר המפלגות מחולקים בדיוק 120 מנדטים לפי שיטת השארית הגדולה, ולכן המספר הגדול יכול להיות גבוה מהממוצע המדויק שמופיע לידו.</div>`:""}`;
  $("warns").innerHTML=warns.length?`<b>שימו לב</b><ul>${[...new Set(warns)].map(w=>`<li>${esc(w)}</li>`).join("")}</ul>`:"";
  renderCompare();
}

function renderCompare(){
  const parties=[...new Set(SOURCES.flatMap(s=>Object.keys(s.seats)))].filter(p=>LISTS[p]);
  const avg=SOURCES[0];
  parties.sort((a,b)=>(avg.seats[b]||0)-(avg.seats[a]||0));
  const cols=[...POLLS,avg];
  let html=`<div class="foot" style="margin:0 0 10px;font-size:13px;color:var(--ink2)">מועמדים שנמצאים בטווח החם לפחות באחד הסקרים · ${filterLabel()}</div>
  <div class="legend"><span><i class="sw c-safe"></i>נכנס בבטחה (עד N-3)</span><span><i class="sw c-in"></i>נכנס, בטווח החם</span><span><i class="sw c-hot"></i>בטווח החם, לא נכנס</span><span><i class="sw c-out"></i>לא נכנס</span><span><i class="sw c-na"></i>המפלגה מתחת לחסימה</span></div>
  <table class="cmp"><thead><tr><th>מקום</th><th style="text-align:right">מועמד/ת</th>${cols.map(s=>`<th class="${s.id==="avg"?"avgcol":""}">${esc(s.short)}${s.date?`<br><span style="font-weight:400">${s.date}</span>`:""}</th>`).join("")}<th>נכנס ב-</th></tr></thead><tbody>`;
  let any=false;
  parties.forEach(party=>{
    const list=LISTS[party];
    const posSet=new Set();
    cols.forEach(s=>{const N=s.seats[party]||0;if(N>0)for(let p=Math.max(1,N-2);p<=N+2;p++)posSet.add(p)});
    const cands=[...posSet].sort((a,b)=>a-b).map(p=>list.find(c=>c.pos===p)||{pos:p,missing:true}).filter(c=>c.missing?state.g==="all":gMatch(genderOf(c)));
    if(!cands.length)return;
    any=true;
    html+=`<tr class="party"><td colspan="2">${esc(party)}</td>${cols.map(s=>`<td class="sn ${s.id==="avg"?"avgcol":""}">${s.seats[party]||"–"}</td>`).join("")}<td class="sn"></td></tr>`;
    cands.forEach(c=>{
      let entered=0;
      const cells=cols.map(s=>{
        const N=s.seats[party]||0;let cls,txt="";
        if(!N){cls="c-na"}
        else if(c.pos<=N-3){cls="c-safe";txt="✓"}
        else if(c.pos<=N){cls="c-in";txt="✓"}
        else if(c.pos<=N+2){cls="c-hot";txt="·"}
        else cls="c-out";
        if(s.id!=="avg"&&N&&c.pos<=N)entered++;
        return `<td class="${s.id==="avg"?"avgcol":""}"><span class="cell ${cls}" title="${esc(s.label)}">${txt}</span></td>`;
      }).join("");
      const name=c.missing?`<span class="cu">אין נתונים למקום הזה</span>`:`<button type="button" class="cname" data-key="${esc(party+"|"+c.pos)}">${esc(displayName(c))}</button> <span class="tag ${genderOf(c)}">${G_LABEL[genderOf(c)]}</span>`;
      html+=`<tr><td>${c.pos}</td><td class="name">${name}</td>${cells}<td><b>${entered}</b>/${POLLS.length}</td></tr>`;
    });
  });
  html+=`</tbody></table>`;
  if(!any)html+=`<p class="below">אין מועמדים שמתאימים למסנן.</p>`;
  $("capCompare").innerHTML=html;
  $("capCompare").style.display="inline-block";
}

async function exportPng(btn){
  const el=$(btn.dataset.target);
  const old=btn.textContent;btn.textContent="מייצא…";btn.disabled=true;
  document.body.classList.add("exporting");
  try{
    const url=await htmlToImage.toPng(el,{pixelRatio:2,backgroundColor:"#ffffff",width:el.scrollWidth,height:el.scrollHeight});
    const src=SOURCES.find(s=>s.id===state.src);
    const a=document.createElement("a");
    a.href=url;a.download=`${btn.dataset.name}-${btn.dataset.target==="capParties"?src.short+"-":""}${state.g}.png`;
    document.body.appendChild(a);a.click();a.remove();
    btn.textContent="נשמר";
  }catch(e){console.error(e);btn.textContent="הייצוא נכשל"}
  finally{document.body.classList.remove("exporting")}
  setTimeout(()=>{btn.textContent=old;btn.disabled=false},1800);
}

// Candidate detail card. One dialog, opened from any .cname button.
let cdOpener=null;
function initials(name){return name.replace(/\(.*?\)/g,"").trim().split(/\s+/).slice(0,2).map(w=>w[0]||"").join("")}
function safeUrl(u){try{const x=new URL(u);return x.protocol==="https:"?x.href:""}catch{return ""}}
function openDetails(btn){
  const key=btn.dataset.key;
  const [party,posStr]=key.split("|");const pos=+posStr;
  const cand=(LISTS[party]||[]).find(c=>c.pos===pos);
  const d=DETAILS[key]||null;
  const name=cand?displayName(cand):((d&&d.name)||"");
  const img=d&&safeUrl(d.image||"");
  const he=d&&safeUrl(d.wikiHe||""),en=d&&safeUrl(d.wikiEn||""),file=d&&safeUrl(d.imageFilePage||"");
  const hasInfo=!!(d&&(d.summaryHe||he||en||img));
  const avatar=`<div class="cd-avatar" aria-hidden="true">${esc(initials(name))}</div>`;
  const credit=img&&(d.imageCredit||d.imageLicense)?`<p class="cd-credit">תמונה: ${esc(d.imageCredit||"")}${d.imageLicense?` · ${esc(d.imageLicense)}`:""} · ${file?`<a href="${esc(file)}" target="_blank" rel="noopener">ויקישיתוף</a>`:"ויקישיתוף"}</p>`:"";
  $("cdBody").innerHTML=`
    <div class="cd-head">
      ${img?`<img class="cd-img" src="${esc(img)}" alt="${esc(name)}" loading="lazy" referrerpolicy="no-referrer">`:avatar}
      <div><h2 id="cdTitle">${esc(name)}</h2>
        <div class="cd-meta"><span class="cd-party">${esc(party)}</span><span>מקום ${pos} ברשימה</span></div></div>
    </div>
    ${hasInfo?`${d.summaryHe?`<p class="cd-sum">${esc(d.summaryHe)}</p>`:""}
      ${d.matchConfidence==="medium"?`<p class="cd-note">ההתאמה בין המועמד לבין הערך בוויקיפדיה לא אומתה במלואה.</p>`:""}
      ${he||en?`<div class="cd-links">${he?`<a class="cd-btn" href="${esc(he)}" target="_blank" rel="noopener">ויקיפדיה</a>`:""}${en?`<a class="cd-btn" href="${esc(en)}" target="_blank" rel="noopener" lang="en">English</a>`:""}</div>`:""}
      ${credit}`:`<p class="cd-empty">אין מידע נוסף זמין</p>`}`;
  const im=$("cdBody").querySelector(".cd-img");
  if(im)im.addEventListener("error",()=>{im.outerHTML=avatar},{once:true});
  cdOpener=btn;
  const dlg=$("cdModal");
  dlg.showModal();
  $("cdClose").focus();
}
document.addEventListener("click",e=>{
  const b=e.target.closest(".cname");
  if(b){openDetails(b);return}
  if(e.target===$("cdModal")||e.target.closest("#cdClose"))$("cdModal").close();
});
$("cdModal").addEventListener("close",()=>{if(cdOpener&&document.contains(cdOpener))cdOpener.focus();cdOpener=null});
load();
