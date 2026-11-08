
"use strict";
/* ================= CORE: state, utils, persistence, demo ================= */
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const LS_KEY='payrollPro.v2';
const WD=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const WD_IDX={sunday:0,monday:1,tuesday:2,wednesday:3,thursday:4,friday:5,saturday:6,none:-1};
const MON=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const PALETTE=['#4f8cff','#2fd07c','#a78bfa','#fbbf24','#2dd4ee','#f472b6','#fb923c','#94a3b8'];
const HL_COLORS={r:{n:'Problem',css:'#c62833'},y:{n:'Review',css:'#d19a12'},g:{n:'Verified',css:'#1d9e5f'},b:{n:'OT day',css:'#2563d9'},k:{n:'Absent',css:'#0a0b0e'},custom:{n:'Custom colour',css:'#7c3aed'}};
const DEFAULT_RULES={nh:8,otHr:0,otDay:0,count:'hours',absRule:'prop',absFixed:0,pen:0,start:1,dim:30,offDay:'Friday'};
const MASTER_HEADERS=["Name","Employee ID (Iqama)","Site / Department / Branch","Position","Basic Salary","Pay By (Day/Hour)","Rate per Day","Rate per Hour","OT Multiplier","OT Fixed Rate","Days in Month","Off Day","Advance Amount","Advance Months","Penalty per Absence","Special ID","Remarks"];
const MASTER_FIELDS=['name','id','site','position','basic','payBy','rateDay','rateHour','otMult','otFixed','dim','offDay','adv','advM','pen','specId','remarks'];

function curMonth(){const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');}
const DEFAULT_DASH_ORDER=['panel-sites','panel-ot','panel-siteTable','panel-status'];
function defaultState(){return{settings:{theme:'dark',month:curMonth(),company:'Daker Staffing Co.'},
  ui:{flagsOpen:true,resCols:['flag','status','id','name','site','basic','worked','otH','otPay','abs','absDed','pen','advD','net'],pageSize:25,barTop:10,
      dashOrder:DEFAULT_DASH_ORDER.slice(),inspector:{x:null,y:null,w:340,h:null,mini:false},fill:'#7c3aed',text:'#ffffff',taskFilter:'open'},
  master:[],sheets:[],mappings:{},highlights:{},templates:[],activity:[],seeded:false,masterFile:'',
  clients:[],tasks:[],accepted:{},lastRefresh:0,dateEngine:{}};}
let S=defaultState();
const RT={tab:'dashboard',q:'',site:'all',flagged:false,sortKey:'sev',sortDir:'desc',page:1,empQ:'',empSite:'all',
  gSite:null,gBrush:'inspect',gFilter:'all',gSel:new Set(),painting:false,tplId:null,charts:{},mapQueue:[],mapCur:null,issues:[],undo:null,
  inspector:null,arrange:false,dragPid:null,clientId:null,autoDates:true};
let R=[],AGG=null;

function save(){clearTimeout(save._t);save._t=setTimeout(()=>{try{localStorage.setItem(LS_KEY,JSON.stringify(S));const c=$('#saveChip');if(c){c.classList.remove('flash');void c.offsetWidth;c.classList.add('flash');}updateStorageMeter();}catch(e){toast('Storage full — export a backup and clear old months.','err');}},250);}
function loadState(){try{const raw=localStorage.getItem(LS_KEY);if(raw){const p=JSON.parse(raw);if(p&&p.settings){S=Object.assign(defaultState(),p);S.ui=Object.assign(defaultState().ui,p.ui||{});
  S.ui.inspector=Object.assign(defaultState().ui.inspector,p.ui&&p.ui.inspector||{});
  S.ui.dashOrder=(Array.isArray(p.ui&&p.ui.dashOrder)&&p.ui.dashOrder.length)?p.ui.dashOrder.slice():DEFAULT_DASH_ORDER.slice();
  S.clients=Array.isArray(p.clients)?p.clients:[];S.tasks=Array.isArray(p.tasks)?p.tasks:[];
  S.accepted=p.accepted&&typeof p.accepted==='object'?p.accepted:{};
  S.dateEngine=p.dateEngine&&typeof p.dateEngine==='object'?p.dateEngine:{};
  S.lastRefresh=+p.lastRefresh||0;
  return true;}}}catch(e){}return false;}
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icon=(n,st='')=>`<svg class="ic" ${st?`style="${st}"`:''}><use href="#i-${n}"/></svg>`;
const nf=new Intl.NumberFormat('en-US',{maximumFractionDigits:2});
const nf0=new Intl.NumberFormat('en-US',{maximumFractionDigits:0});
const fnum=(n,d=2)=>(d===0?nf0:nf).format(+n||0);
const money=n=>'SAR '+nf.format(Math.round((+n||0)*100)/100);
const moneyShort=n=>{n=+n||0;return Math.abs(n)>=1e6?'SAR '+(n/1e6).toFixed(2)+'M':money(n);};
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,7);
const debounce=(f,ms)=>{let t;return(...a)=>{clearTimeout(t);t=setTimeout(()=>f(...a),ms);};};
const normKey=s=>String(s??'').toLowerCase().replace(/[^a-z0-9\u0600-\u06FF]/g,'');
function toast(msg,type='ok',action){const t=document.createElement('div');t.className='toast '+type;
  t.innerHTML=`${icon(type==='err'?'alert':type==='warn'?'alert':'check','width:15px;height:15px;flex:none')}<span style="flex:1">${msg}</span>${action?`<button data-toast-act>${esc(action.label)}</button>`:''}<button data-toast-x aria-label="Dismiss">${icon('x','width:13px;height:13px')}</button>`;
  if(action)t.querySelector('[data-toast-act]').onclick=()=>{action.fn();t.remove();};
  t.querySelector('[data-toast-x]').onclick=()=>t.remove();
  $('#toasts').appendChild(t);while($('#toasts').children.length>4)$('#toasts').firstChild.remove();
  setTimeout(()=>{t.style.opacity='0';t.style.transition='opacity .3s';setTimeout(()=>t.remove(),320);},type==='err'?6500:4000);}
function act(msg,ic='zap'){S.activity.unshift({t:Date.now(),msg,ic});S.activity=S.activity.slice(0,14);save();if(RT.tab==='dashboard')renderActivity();}
function timeAgo(t){const s=(Date.now()-t)/1e3;if(s<60)return'just now';if(s<3600)return Math.floor(s/60)+'m ago';if(s<86400)return Math.floor(s/3600)+'h ago';return Math.floor(s/86400)+'d ago';}
function openModal(html,wide){const box=$('#modalBox');box.className='modal'+(wide?' wide':'');box.style.maxWidth='';box.innerHTML=html;$('#modalOv').classList.add('open');}
function closeModal(){$('#modalOv').classList.remove('open');}
function openDrawer(html){$('#drawerBody').innerHTML=html;$('#drawer').classList.add('open');$('#drawerOv').classList.add('open');}
function closeDrawer(){$('#drawer').classList.remove('open');$('#drawerOv').classList.remove('open');}
function confirmDlg(title,msg,label,fn,danger=true){openModal(`<header>${icon(danger?'alert':'info','color:var('+(danger?'--danger':'--info')+')')}<h3>${esc(title)}</h3></header><p style="font-size:13px;color:var(--tx2)">${msg}</p><div class="mfoot"><button class="btn" data-action="closeModal">Cancel</button><button class="btn ${danger?'btn-d':'btn-p'}" id="confirmYes">${esc(label)}</button></div>`);$('#confirmYes').onclick=()=>{closeModal();fn();};}
function downloadBlob(blob,name){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},400);}
function aoaToCsv(aoa){return '\uFEFF'+aoa.map(r=>r.map(c=>{const s=String(c??'');return /[",\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s;}).join(',')).join('\r\n');}
function exportAoa(aoa,baseName,widths){ // xlsx if SheetJS present, CSV fallback (offline)
  if(window.XLSX){try{const ws=XLSX.utils.aoa_to_sheet(aoa);if(widths)ws['!cols']=widths.map(w=>({wch:w}));const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'Payroll');XLSX.writeFile(wb,baseName+'.xlsx');return true;}catch(e){}}
  downloadBlob(new Blob([aoaToCsv(aoa)],{type:'text/csv;charset=utf-8'}),baseName+'.csv');
  toast('SheetJS unavailable (offline) — exported CSV instead, Excel opens it directly.','warn');return true;}
function updateStorageMeter(){try{const bytes=(localStorage.getItem(LS_KEY)||'').length*2;const kb=bytes/1024;const el=$('#storeMeter');if(el){el.style.width=Math.min(100,bytes/5e6*100).toFixed(1)+'%';$('#storeText').textContent=(kb>1024?(kb/1024).toFixed(2)+' MB':kb.toFixed(0)+' KB')+' of ~5 MB localStorage';}}catch(e){}}

/* ---- pay period ---- */
function rulesOf(site){const m=S.mappings[site];return Object.assign({},DEFAULT_RULES,m&&m.rules||{});}
function periodOf(site){const ru=rulesOf(site);const[y,m]=S.settings.month.split('-').map(Number);const start=Math.min(28,Math.max(1,ru.start||1));
  let d0,d1;if(start===1){d0=new Date(y,m-1,1);d1=new Date(y,m,0);}else{d0=new Date(y,m-1,start);d1=new Date(y,m,start-1);}
  const dates=[];for(let d=new Date(d0);d<=d1;d.setDate(d.getDate()+1))dates.push(new Date(d));
  const label=dates.length?`${dates[0].getDate()} ${MON[dates[0].getMonth()]} – ${d1.getDate()} ${MON[d1.getMonth()]} ${d1.getFullYear()}`:'';
  return{dates,len:dates.length,label,start};}
function monthLabel(){const[y,m]=S.settings.month.split('-').map(Number);return MON[m-1]+' '+y;}
function offIdxFor(emp,ru){const v=(emp&&emp.offDay)||ru.offDay||'Friday';return WD_IDX[String(v).toLowerCase()]??5;}
function allSites(){const set=new Set();S.master.forEach(e=>e.site&&set.add(e.site));S.sheets.forEach(s=>set.add(s.site));return[...set].sort((a,b)=>a.localeCompare(b));}
function hlKey(site){return site+'|'+S.settings.month;}
function hlMap(site){return S.highlights[hlKey(site)]||(S.highlights[hlKey(site)]={});}

/* ---- demo seed (deterministic) ---- */
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
function seedDemo(){
  const rnd=mulberry32(20260425);const pick=a=>a[Math.floor(rnd()*a.length)];
  S=defaultState();S.seeded=true;S.masterFile='Demo — Employee Master.xlsx';
  const sites=['Riyadh Metro','Jeddah Port','Dammam Logistics','NEOM Camp 1','King Khalid Airport','Aramco Dhahran','Makkah Tower','Madinah Hotels','Red Sea Project','Qiddiya Site','Jubail Plant','Yanbu Refinery','Taif Resort','Abha Hospital','Tabuk Solar','Hail Warehouse','Buraydah Mall','Khobar Offices','Riyadh Bank HQ','Jeddah Airport','Sakaka Farm','Najran Depot','Jizan Port','Diriyah Gate','AlUla Heritage'];
  const names=['Ahmed Al-Qahtani','Mohammed Khan','Ali Hassan','Ramesh Kumar','Saeed Ahmed','Bilal Khan','John Mathew','Iqbal Hussain','Hassan Ali','Omar Al-Zahrani','Fahad Al-Otaibi','Sultan Al-Harbi','Rajesh Nair','Suresh Pillai','Abdul Rahman','Khalid Al-Ghamdi','Nawaf Al-Dosari','Faisal Al-Mutairi','Sanjay Verma','Arun Prakash','Yousef Ibrahim','Tariq Aziz','Bandar Al-Shehri','Majed Al-Anazi','Vijay Anand','Praveen Raj','Saleh Al-Yami','Mansour Asiri','Anil Sharma','Deepak Yadav','Turki Al-Subaie','Saud Al-Qahtani','Imran Shaikh','Firoz Alam','Naif Al-Harthy','Ziyad Maliki','Rashid Mehmood','Waseem Akram','Sami Al-Juhani','Hani Badawi','Mishal Al-Rashidi','Karim Fathy','Ashok Reddy','Manoj Das','Amer Sharif','Waleed Sabri','Ravi Chandran','Sunil Shetty','Adel Nasser','Feras Halabi'];
  const positions=['Helper','Operator','Technician','Supervisor','Driver','Welder','Electrician','Storekeeper','Cleaner','Foreman','Mason','Security Guard'];
  const starts=[1,21,25,26],nhs=[8,9,10],othrs=[18,22,25,30],otdays=[120,150,180,200];
  let idc=0,nc=0;const empsBySite=[];
  sites.forEach((site,si)=>{
    const count=4+si%4;const ru={nh:nhs[si%3],otHr:othrs[si%4],otDay:otdays[si%4],count:si%6===5?'days':(si%9===8?'both':'hours'),absRule:si%4===2?'fixed':(si%4===3?'none':'prop'),absFixed:80,pen:si%3===0?25:0,start:starts[si%4],dim:si%9===0?31:30,offDay:si%8===7?'None':'Friday'};
    const variant=si%3;const idCol=variant===0?1:0,nameCol=variant===0?2:1,dayFrom=variant===0?4:(variant===1?2:3);
    S.mappings[site]={idCol,nameCol,dayFrom,dayTo:0,headerRow:0,rules:ru,variant};
    const per=periodOf(site);S.mappings[site].dayTo=dayFrom+per.len-1;
    const rows=[],raw=[];const heads=variant===0?['No.','Emp Code','Employee Name','Trade']:variant===1?['Badge','Full Name']:['Worker ID','Worker','Nationality'];
    for(let d=1;d<=per.len;d++)heads.push(variant===1?'Day '+d:String(d));if(variant===2)heads.push('Total');raw.push(heads);
    const list=[];
    for(let ei=0;ei<count;ei++){
      const id=String(2222222220+((idc*7919)%7770));const name=names[nc++%names.length];const hourly=(idc%7===0);idc++;
      const basic=hourly?0:Math.round((2600+rnd()*3800)/50)*50;
      const emp={id,name,site,position:pick(positions),basic,payBy:hourly?'Hour':'Day',rateDay:hourly?0:Math.round(basic/30),rateHour:hourly?Math.round(14+rnd()*12):0,otMult:1.5,otFixed:idc%11===0?25:0,dim:0,offDay:'',adv:rnd()<.22?Math.round((600+rnd()*1200)/50)*50:0,advM:2+Math.floor(rnd()*3),pen:0,specId:'SP-'+(1000+idc),remarks:idc%9===0?'Transferred between client sites — verify assignment':''};
      S.master.push(emp);list.push(emp);
      const d=[];const off=offIdxFor(emp,ru);
      per.dates.forEach((dt,di)=>{
        const isOff=dt.getDay()===off;let v='';
        if(si===2&&ei===0)v=26;                                     // suspicious: impossible hours
        else if((si===5&&ei===1)||(si===9&&ei===0))v='';             // unsubmitted -> verify
        else if(isOff)v=rnd()<.2?(ru.count==='days'?1:6+Math.round(rnd()*3)):'';
        else{const r=rnd();if(r<.05)v='A';else if(r<.09)v='';else v=ru.count==='days'?(r<.35?1.25:1):ru.nh+(r<.3?1+Math.round(rnd()*3):0);}
        d.push(v);
      });
      rows.push({id,name,d});
      const rr=[];if(variant===0){rr.push(ei+1,id,name,emp.position);}else if(variant===1){rr.push(id,name);}else{rr.push(id,name,'—');}
      d.forEach(v=>rr.push(v));if(variant===2)rr.push('');raw.push(rr);
    }
    empsBySite.push(list);
    S.sheets.push({key:uid()+si,fileName:site.replace(/ /g,'_')+'_Timesheet.xlsx',site,month:S.settings.month,rows,raw,mapped:true});
  });
  // duplicate ID inside master (same person entered on a second site)
  const dup=Object.assign({},S.master[6]);dup.site=sites[12];dup.basic=S.master[6].basic+300;S.master.push(dup);
  // one employee supplied to five different clients, ~5 days each: must be flagged for review, never auto-approved
  const src=S.sheets[3].rows[0];
  [7,12,16,20].forEach((k,j)=>{const sh=S.sheets[k];const len=periodOf(sh.site).len;const d=Array(len).fill('');
    for(let i=j*5;i<j*5+5&&i<len;i++)d[i]=8;
    sh.rows.push({id:src.id,name:src.name,d});});
  // timesheet row with no master record (Iqama-shaped but unmatched)
  S.sheets[11].rows.push({id:'2222229999',name:'Unlisted Worker',d:S.sheets[11].rows[0].d.map(v=>typeof v==='number'?8:v)});
  // master employee whose site sheet is missing his row (no timesheet)
  S.sheets[20].rows=S.sheets[20].rows.slice(0,-1);
  // seeded grid highlights on first site
  const h=hlMap(sites[0]);const per0=periodOf(sites[0]);
  S.sheets[0].rows.forEach((r,ri)=>{if(ri<2)for(let i=0;i<per0.len;i++)h[r.id+'|'+i]={c:'g'};});
  const r2=S.sheets[0].rows[2];if(r2){h[r2.id+'|5']={c:'r',n:'Missing punch-out — ask supervisor'};h[r2.id+'|6']={c:'y',n:'Check OT approval'};}
  const r3=S.sheets[0].rows[3];if(r3)h[r3.id+'|10']={c:'b',n:'Approved off-day OT'};
  seedTemplates();
  S.clients=sites.map((s,i)=>({id:'cl-'+i,name:s,branch:s.split(' ')[0]+' Branch',company:'Client group '+s.split(' ')[0],contact:'',
    billingRate:[38,42,45,50][i%4],billingUnit:i%6===5?'day':'hour',color:PALETTE[i%PALETTE.length],
    notes:'Employees supplied by '+S.settings.company+'. Site / branch: '+s,createdAt:Date.now()}));
  const[y,m]=S.settings.month.split('-').map(Number);const due=new Date(y,m,0);due.setDate(due.getDate()-2);const dueStr=due.toISOString().slice(0,10);
  S.tasks=[
   {id:uid(),title:'Review multi-client assignments',what:'Open Our Client, check each highlighted client tab, then click Accept if the 5-day split is correct.',client:sites[3],due:dueStr,pri:'high',status:'open',createdAt:Date.now()},
   {id:uid(),title:'Verify Iqama & Special ID matching',what:'Open Employee Master and confirm every Iqama is 10 digits starting with 2; resolve any name-only matches.',client:'',due:dueStr,pri:'high',status:'open',createdAt:Date.now()},
   {id:uid(),title:'Confirm client billing rates',what:'Open Client settings and set the rate we charge per hour/day so revenue and margin are accurate.',client:sites[0],due:dueStr,pri:'med',status:'open',createdAt:Date.now()}];
  S.lastRefresh=Date.now();
  S.activity=[{t:Date.now()-9e5,msg:'Demo workspace loaded — 25 sites, replace with your files anytime',ic:'zap'},{t:Date.now()-7e5,msg:'Employee master parsed · '+S.master.length+' rows',ic:'users'},{t:Date.now()-5e5,msg:'25 site mappings applied from saved rules',ic:'map'},{t:Date.now()-2e5,msg:'Payroll calculated for '+monthLabel(),ic:'check'}];
  save();
}
function seedTemplates(){S.templates=[
  {id:'tpl-clientA',name:'Client A Format',title:'Monthly Salary Statement — Client A',cols:['id','name','worked','otH','abs','net'],totals:true,sig:true,status:false},
  {id:'tpl-internal',name:'Internal Format',title:'Internal Payroll Register — All Sites',cols:['id','name','site','basic','otH','otD','otPay','abs','absDed','pen','advD','net'],totals:true,sig:false,status:true}];}
/* ================= CALC: payroll engine, flags, aggregates ================= */
const ABS_CODES=new Set(['a','ab','abs','absent','غ','غياب','absc']);
const OFF_CODES=new Set(['off','o','r','rest','راحة','اجازة','إجازة','holiday','h','leave','l','v','vac','wo','weekoff']);
function parseCell(v,ru){
  if(v===null||v===undefined||v==='')return{h:null,code:null,bad:false};
  if(typeof v==='number')return isFinite(v)?{h:v,code:null,bad:false}:{h:null,code:null,bad:true};
  const s=String(v).trim();if(!s)return{h:null,code:null,bad:false};
  const low=s.toLowerCase();
  if(ABS_CODES.has(low))return{h:0,code:'A',bad:false};
  if(OFF_CODES.has(low))return{h:0,code:'OFF',bad:false};
  if(low==='p'||low==='present')return{h:ru.nh,code:null,bad:false};
  const tm=s.match(/^(\d{1,2}):([0-5]\d)$/);if(tm)return{h:+tm[1]+ +tm[2]/60,code:null,bad:false};
  const n=Number(s.replace(',',''));
  if(isFinite(n)&&s.match(/^-?[\d.,]+$/))return{h:n,code:null,bad:false};
  return{h:null,code:null,bad:true};
}
const SEV={OK:0,Verify:1,Suspicious:2,Duplicate:3};
function statusBadge(r){const m={OK:['b-ok','check','OK'],Verify:['b-ver','alert','Verify'],Suspicious:['b-susp','alert','Suspicious'],Duplicate:['b-dup','flag','Duplicate']}[r.status];
  return `<span class="badge ${m[0]}">${icon(m[1])}${m[2]}</span>`;}
function flagCellHtml(r){if(!r.flags.length)return `<span class="tflag f-ok">—</span>`;
  const cls=r.sev>=2?'f-dup':(r.flags[0].sev==='susp'?'f-susp':'f-ver');
  const extra=r.flags.length>1?` <span class="muted" style="font-weight:600">+${r.flags.length-1}</span>`:'';
  return `<span class="tflag ${cls}" title="${esc(r.flags.map(f=>f.msg).join('\n'))}">${icon('flag')}${esc(r.flags[0].short)}${extra}</span>`;}

function computeAll(){
  const masterCount={},sheetCount={};
  S.master.forEach(e=>{const k=String(e.id).trim();masterCount[k]=(masterCount[k]||0)+1;});
  S.sheets.forEach(sh=>sh.rows.forEach(r=>{const k=String(r.id).trim();sheetCount[k]=(sheetCount[k]||0)+1;}));
  const masterById={},masterBySpec={},masterByName={};const nname=s=>normKey(s).replace(/\s/g,'');
  S.master.forEach(e=>{const k=String(e.id).trim();if(!masterById[k])masterById[k]=e;
    if(e.specId){const s=String(e.specId).trim();(masterBySpec[s]||(masterBySpec[s]=[])).push(e);}
    const n=nname(e.name);if(n)(masterByName[n]||(masterByName[n]=[])).push(e);});
  const sitesById={};S.sheets.forEach(sh=>sh.rows.forEach(row=>{const k=String(row.id).trim();(sitesById[k]||(sitesById[k]=new Set())).add(sh.site);}));
  const accepted=S.accepted||{};
  const goodIqama=id=>/^2\d{9}$/.test(String(id).trim());
  const matchEmployee=row=>{
    const id=String(row.id||'').trim();
    if(masterById[id])return{emp:masterById[id],method:'Iqama'};
    const sid=String(row.specId||'').trim();
    if(sid&&masterBySpec[sid])return{emp:masterBySpec[sid][0],method:'Special ID',note:masterBySpec[sid].length>1?'Special ID is shared by '+masterBySpec[sid].length+' master rows':'Matched by Special ID — Iqama differs from the master'};
    const n=nname(row.name||'');const byN=masterByName[n]||[];
    if(byN.length===1)return{emp:byN[0],method:'Name',note:'Matched by NAME only — confirm Iqama '+id+' is correct'};
    if(byN.length>1)return{emp:byN[0],method:'Ambiguous name',note:byN.length+' master employees share this name — manual match required'};
    const rem=normKey(row.remarks||'');if(rem){const byR=S.master.filter(e=>normKey(e.remarks)===rem);if(byR.length===1)return{emp:byR[0],method:'Remarks',note:'Matched using Remarks only — confirm identity'};}
    return{emp:null,method:'None'};
  };
  R=[];
  const sparks={hours:Array(31).fill(0),otPay:Array(31).fill(0),abs:Array(31).fill(0),net:Array(31).fill(0),ded:Array(31).fill(0)};
  const pushRow=(emp,row,sh,mt)=>{
    const site=sh?sh.site:(emp.site||'—');const ru=rulesOf(site);const per=periodOf(site);
    const nh=Math.max(1,ru.nh||8);const dim=Math.max(1,(emp&&emp.dim)||ru.dim||30);
    const offIdx=offIdxFor(emp,ru);const daysMode=ru.count==='days';
    let workedH=0,workedD=0,otH=0,otD=0,abs=0,badCells=0,bigCell=false;const days=[];
    for(let i=0;i<per.len;i++){
      const raw=row?row.d[i]:undefined;const c=parseCell(raw,ru);const dt=per.dates[i];const isOff=dt.getDay()===offIdx&&offIdx>=0;
      let type='blank',dOtH=0,dOtD=0,dH=0;
      if(c.bad){badCells++;type='bad';}
      else if(c.code==='A'){abs++;type='abs';}
      else if(c.code==='OFF'){type='off';}
      else if(c.h!==null&&c.h>0){
        if(c.h>24)bigCell=true;
        if(daysMode){const dv=Math.min(c.h,1);
          if(isOff){dOtD=dv;otD+=dv;workedD+=dv;type='offwork';}
          else{workedD+=dv;dOtH=Math.max(0,c.h-1)*nh;otH+=dOtH;dH=dv*nh;workedH+=dH;type=dOtH>0?'ot':'normal';}
        }else{dH=c.h;workedH+=c.h;workedD+=1;
          if(isOff){dOtD=1;otD+=1;type='offwork';}
          else{dOtH=Math.max(0,c.h-nh);otH+=dOtH;type=dOtH>0?'ot':'normal';}
        }
      }else if(isOff)type='off';
      days.push({i,dt,raw,h:c.h,type,otH:dOtH,otD:dOtD});
      if(i<31){sparks.hours[i]+=dH;sparks.abs[i]+=(type==='abs'?1:0);}
    }
    // money
    const e=emp||{basic:0,payBy:'Day',rateDay:0,rateHour:0,otMult:1.5,otFixed:0,adv:0,advM:1,pen:0};
    let basic=+e.basic||0;
    if(!basic&&String(e.payBy).toLowerCase().startsWith('h'))basic=(+e.rateHour||0)*nh*dim;
    if(!basic&&+e.rateDay)basic=(+e.rateDay)*dim;
    const baseHourly=(+e.rateHour>0)?+e.rateHour:(+e.rateDay>0?+e.rateDay/nh:(basic>0?basic/(dim*nh):0));
    const otHr=+ru.otHr>0?+ru.otHr:(+e.otFixed>0?+e.otFixed:baseHourly*(+e.otMult||1.5));
    const otDayRate=+ru.otDay>0?+ru.otDay:otHr*nh;
    const otPay=otH*otHr+otD*otDayRate;
    const absRate=ru.absRule==='prop'?basic/dim:(ru.absRule==='fixed'?(+ru.absFixed||0):0);
    const absDed=abs*absRate;
    const penRate=(+e.pen>0)?+e.pen:(+ru.pen||0);
    const pen=abs*penRate;
    const advD=(+e.adv>0)?(+e.adv)/Math.max(1,+e.advM||1):0;
    const totDed=absDed+pen+advD;
    const net=basic+otPay-totDed;
    // flags
    const flags=[];const id=row?String(row.id).trim():(emp?String(emp.id).trim():'');
    const dupM=(masterCount[id]||0)>1,dupS=(sheetCount[id]||0)>1;
    if(dupM)flags.push({sev:'dup',short:'Duplicate ID',msg:`Employee ID ${id} appears ${masterCount[id]}× in the Employee Master`});
    if(dupS)flags.push({sev:'dup',short:'In '+sheetCount[id]+' sheets',msg:`Employee ID ${id} appears in ${sheetCount[id]} timesheets`});
    const maxH=per.len*24;
    if(workedH>maxH)flags.push({sev:'susp',short:'Excess hours',msg:`Total ${fnum(workedH,0)} h exceeds maximum possible (${per.len} days × 24 h = ${maxH} h)`});
    if(workedD>per.len)flags.push({sev:'susp',short:'Excess days',msg:`${fnum(workedD,1)} days worked exceeds period length (${per.len})`});
    if(bigCell)flags.push({sev:'susp',short:'Day > 24h',msg:'A single day cell records more than 24 hours'});
    if(!emp)flags.push({sev:'ver',short:'No master',msg:`Iqama ${id} was not found by Iqama / Special ID / Name / Remarks — pay defaults to 0`});
    if(!row)flags.push({sev:'ver',short:'No timesheet',msg:'No timesheet row submitted for this employee'});
    if(id&&!goodIqama(id))flags.push({sev:'ver',short:'Invalid Iqama',msg:`"${id}" is not a 10-digit Iqama starting with 2 (example: 2222222220)`});
    if(mt&&mt.method==='Name')flags.push({sev:'ver',short:'Name-only match',msg:mt.note});
    if(mt&&mt.method==='Ambiguous name')flags.push({sev:'ver',short:'Ambiguous name',msg:mt.note});
    if(mt&&mt.method==='Special ID')flags.push({sev:'ver',short:'ID mismatch',msg:mt.note});
    if(mt&&mt.method==='Remarks')flags.push({sev:'ver',short:'Remarks match',msg:mt.note});
    const clientSites=[...(sitesById[id]||[])];
    const multiPending=clientSites.length>1&&!accepted[S.settings.month+'|'+id];
    if(multiPending)flags.push({sev:'multi',short:'Multi-client review',msg:`Iqama ${id} works for ${clientSites.length} clients (${clientSites.join(', ')}). This can be completely normal — review each client tab, then click Accept to clear the flag.`});
    if(row&&abs===0&&otH===0&&otD===0)flags.push({sev:'ver',short:'No OT & no abs.',msg:'0 absences AND 0 OT for the whole period — verify the sheet was actually submitted'});
    if(badCells)flags.push({sev:'ver',short:badCells+' unreadable',msg:`${badCells} day cell(s) contain values that are neither hours nor known codes`});
    const hl=hlMap(site);let hlR=0,hlY=0,hlG=0,hlB=0,hlK=0,notes=0;
    if(emp||row){for(let i=0;i<per.len;i++){const hc=hl[id+'|'+i];if(hc){if(hc.c==='r')hlR++;if(hc.c==='y')hlY++;if(hc.c==='g')hlG++;if(hc.c==='b')hlB++;if(hc.c==='k')hlK++;if(hc.n)notes++;}}}
    if(hlR)flags.push({sev:'ver',short:'Grid problem',msg:`${hlR} day cell(s) marked red (problem) in the Day Grid`});
    if(net<0)flags.push({sev:'ver',short:'Negative net',msg:'Deductions exceed earnings — net pay is negative'});
    const order={dup:3,susp:2,multi:1.6,ver:1};flags.sort((a,b)=>order[b.sev]-order[a.sev]);
    const status=!flags.length?'OK':(flags[0].sev==='dup'?'Duplicate':flags[0].sev==='susp'?'Suspicious':'Verify');
    const cl=(S.clients||[]).find(c=>c.name===site);
    const billRate=+(cl&&cl.billingRate)||0;
    const revenue=(cl&&cl.billingUnit==='day'?workedD:workedH)*billRate;
    const margin=revenue-net;
    const r={key:(sh?sh.key:'master')+'|'+id,id,name:(emp&&emp.name)||row.name||'—',site,position:(emp&&emp.position)||'—',
      specId:(emp&&emp.specId)||row.specId||'',remarks:(emp&&emp.remarks)||row.remarks||'',matchMethod:(mt&&mt.method)||'—',
      multiClients:clientSites,multiPending,clientCount:clientSites.length,
      basic,workedH,workedD,otH,otD,otPay,abs,absDed,pen,advD,totDed,net,status,sev:SEV[status],flags,
      revenue,margin,billingRate:billRate,billingUnit:(cl&&cl.billingUnit)||'hour',
      hl:{r:hlR,y:hlY,g:hlG,b:hlB,k:hlK,notes},days,sheetKey:sh?sh.key:null,hasSheet:!!row,count:ru.count,
      rates:{otHr,otDayRate,absRate,penRate,dim,nh,len:per.len},adv:{amt:+e.adv||0,m:Math.max(1,+e.advM||1)}};
    // per-day money sparks
    days.forEach(dd=>{if(dd.i>=31)return;const dayOt=dd.otH*otHr+dd.otD*otDayRate;sparks.otPay[dd.i]+=dayOt;
      const dayDed=(dd.type==='abs'?(absRate+penRate):0)+advD/Math.max(1,per.len);sparks.ded[dd.i]+=dayDed;
      sparks.net[dd.i]+=basic/Math.max(1,per.len)+dayOt-dayDed;});
    R.push(r);
  };
  const seen=new Set();
  S.sheets.forEach(sh=>{sh.rows.forEach(row=>{const mt=matchEmployee(row);pushRow(mt.emp||null,row,sh,mt);
    seen.add(String(mt.emp?mt.emp.id:row.id).trim()+'@'+sh.site);});});
  S.master.forEach(e=>{const id=String(e.id).trim();if(!seen.has(id+'@'+e.site)&&!S.sheets.some(sh=>sh.site===e.site&&sh.rows.some(x=>matchEmployee(x).emp===e)))pushRow(e,null,null,{method:'Master'});});
  // aggregates
  const bySiteMap={};let net=0,ot=0,ded=0,absT=0,otHours=0,revenue=0,margin=0;const counts={OK:0,Verify:0,Suspicious:0,Duplicate:0};
  R.forEach(r=>{net+=r.net;ot+=r.otPay;ded+=r.totDed;absT+=r.abs;otHours+=r.otH;revenue+=r.revenue;margin+=r.margin;counts[r.status]++;
    const b=bySiteMap[r.site]||(bySiteMap[r.site]={site:r.site,emp:0,net:0,ot:0,ded:0,flags:0,revenue:0,margin:0,multi:0});b.emp++;b.net+=r.net;b.ot+=r.otPay;b.ded+=r.totDed;b.revenue+=r.revenue;b.margin+=r.margin;if(r.sev>0)b.flags++;if(r.multiPending)b.multi++;});
  const bySite=Object.values(bySiteMap).sort((a,b)=>b.net-a.net);
  const flagged=R.filter(r=>r.sev>0).sort((a,b)=>b.sev-a.sev||a.name.localeCompare(b.name));
  AGG={net,ot,ded,abs:absT,otHours,counts,bySite,flagged,sparks,revenue,margin,
    multiPending:R.filter(r=>r.multiPending).length,empCount:new Set(R.map(r=>r.id)).size,rowCount:R.length,siteCount:bySite.length};
}
function recompute(){computeAll();renderAll();save();}

/* ---- shared column model (results table + templates + exports) ---- */
const COLS=[
 {k:'flag',label:'Red Flag',always:true},
 {k:'status',label:'Status'},
 {k:'id',label:'Iqama (Employee ID)'},
 {k:'name',label:'Name',always:true},
 {k:'specId',label:'Special ID'},
 {k:'matchMethod',label:'Matched By'},
 {k:'site',label:'Client / Site'},
 {k:'position',label:'Position'},
 {k:'clients',label:'Clients'},
 {k:'basic',label:'Basic (SAR)',num:true},
 {k:'worked',label:'Worked',num:true},
 {k:'otH',label:'OT Hours',num:true},
 {k:'otD',label:'OT Off-Days',num:true},
 {k:'otPay',label:'OT Pay (SAR)',num:true},
 {k:'abs',label:'Absences',num:true},
 {k:'absDed',label:'Absence Ded.',num:true},
 {k:'pen',label:'Penalty',num:true},
 {k:'advD',label:'Advance Ded.',num:true},
 {k:'totDed',label:'Total Ded.',num:true},
 {k:'net',label:'Net Pay (SAR)',num:true,always:true},
 {k:'revenue',label:'Client Revenue (SAR)',num:true},
 {k:'margin',label:'Margin (SAR)',num:true},
 {k:'remarks',label:'Remarks'},
 {k:'hl',label:'Grid Highlights'}
];
const MONEY_COLS=new Set(['basic','otPay','absDed','pen','advD','totDed','net','revenue','margin']);
function workedStr(r){const h=fnum(r.workedH,r.workedH%1?1:0),d=fnum(r.workedD,r.workedD%1?1:0);
  return r.count==='days'?d+' d':r.count==='both'?d+' d · '+h+' h':h+' h';}
function hlStr(r){const p=[];if(r.hl.g)p.push(r.hl.g+' verified');if(r.hl.r)p.push(r.hl.r+' flagged');if(r.hl.y)p.push(r.hl.y+' review');if(r.hl.b)p.push(r.hl.b+' OT');if(r.hl.k)p.push(r.hl.k+' absent');return p.join(', ')||'—';}
function colRaw(r,k){switch(k){case 'flag':return r.flags.map(f=>f.short).join('; ')||'—';case 'status':return r.status;
  case 'worked':return workedStr(r);case 'hl':return hlStr(r);case 'otH':return Math.round(r.otH*10)/10;case 'otD':return Math.round(r.otD*10)/10;
  case 'clients':return r.clientCount||1;case 'revenue':case 'margin':return Math.round((r[k]||0)*100)/100;
  case 'specId':return r.specId||'—';case 'remarks':return r.remarks||'—';case 'matchMethod':return r.matchMethod||'—';
  case 'basic':case 'otPay':case 'absDed':case 'pen':case 'advD':case 'totDed':case 'net':return Math.round(r[k]*100)/100;default:return r[k];}}
function colSortVal(r,k){switch(k){case 'flag':case 'status':return r.sev;case 'worked':return r.workedH;case 'hl':return r.hl.r*100+r.hl.y;
  case 'name':case 'id':case 'site':case 'position':case 'specId':case 'remarks':case 'matchMethod':return String(colRaw(r,k)).toLowerCase();default:return +r[k]||0;}}
function colDisplay(r,k){const v=colRaw(r,k);if(MONEY_COLS.has(k))return fnum(v);return typeof v==='number'?fnum(v):esc(v);}
/* ================= DASHBOARD ================= */
const TAB_META={dashboard:['Payroll Dashboard','All sites · one payroll run'],results:['Payroll Results','Every employee, every site — filter, sort, export'],employees:['Employee Master','One sheet, all employees — the source of pay rates'],timesheets:['Timesheets & Column Mapping','25 layouts, remembered per site'],grid:['Day Grid','Paint highlights, verify rows, add notes'],templates:['Template Generator','Design your own export format'],export:['Export & Print','Excel, custom templates and clean printouts'],settings:['Data & Settings','Theme, backup, deployment']};
function cssVar(n){return getComputedStyle(document.documentElement).getPropertyValue(n).trim();}
function sparkSvg(data,color,type,gid){const d=(data&&data.length?data:[0,0]).map(v=>+v||0);const max=Math.max(...d,1e-9),min=Math.min(...d,0);
  const W=100,H=34,n=d.length;
  if(type==='bars'){const bw=Math.max(2,W/n-2);let rects='';d.forEach((v,i)=>{const h=Math.max(2,(v-min)/(max-min||1)*H);rects+=`<rect x="${(i*W/n+1).toFixed(1)}" y="${(H-h).toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" rx="1.5" fill="${color}" opacity="${(0.45+0.55*(v-min)/(max-min||1)).toFixed(2)}"/>`;});
    return `<svg class="spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">${rects}</svg>`;}
  const pts=d.map((v,i)=>[i*(W/(n-1||1)),H-2-((v-min)/(max-min||1))*(H-6)]);
  const path='M'+pts.map(p=>p[0].toFixed(1)+' '+p[1].toFixed(1)).join(' L');
  return `<svg class="spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${color}" stop-opacity=".35"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient></defs><path d="${path} L${W} ${H} L0 ${H} Z" fill="url(#${gid})"/><path d="${path}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round"/></svg>`;}
function animateNum(el,target,fmt){const from=el._v||0;el._v=target;const t0=performance.now(),dur=620;
  function step(t){const p=Math.min(1,(t-t0)/dur),e=1-Math.pow(1-p,3);el.textContent=fmt(from+(target-from)*e);if(p<1)requestAnimationFrame(step);}
  requestAnimationFrame(step);}
function renderKpis(){
  const a=AGG;const empSpark=a.bySite.map(s=>s.emp);
  const defs=[
    {id:'kEmp',label:'Total Employees',v:a.empCount,fmt:v=>fnum(Math.round(v),0),c:'var(--blue)',hex:'#4f8cff',spark:sparkSvg(empSpark,'#4f8cff','bars'),cap:`${a.rowCount} payroll rows · per site`},
    {id:'kSite',label:'Total Sites',v:a.siteCount,fmt:v=>fnum(Math.round(v),0),c:'var(--cyan)',hex:'#2dd4ee',spark:sparkSvg(a.bySite.map(s=>s.net),'#2dd4ee','bars'),cap:'active this period'},
    {id:'kNet',label:'Total Net Pay',v:a.net,fmt:v=>moneyShort(v),c:'var(--green)',hex:'#2fd07c',spark:sparkSvg(a.sparks.net,'#2fd07c','area','gNet'),cap:'SAR · trend by period day',money:a.net},
    {id:'kOt',label:'Total OT Pay',v:a.ot,fmt:v=>moneyShort(v),c:'var(--amber)',hex:'#fbbf24',spark:sparkSvg(a.sparks.otPay,'#fbbf24','area','gOt'),cap:`${fnum(a.otHours,0)} OT hours · by day`,money:a.ot},
    {id:'kDed',label:'Total Deductions',v:a.ded,fmt:v=>moneyShort(v),c:'var(--orange)',hex:'#fb923c',spark:sparkSvg(a.sparks.ded,'#fb923c','area','gDed'),cap:'absence + penalty + advance',money:a.ded},
    {id:'kAbs',label:'Total Absences',v:a.abs,fmt:v=>fnum(Math.round(v),0),c:'var(--pink)',hex:'#f472b6',spark:sparkSvg(a.sparks.abs,'#f472b6','bars'),cap:'days · by period day'}
  ];
  const flagBars=[a.counts.Duplicate,a.counts.Suspicious,a.counts.Verify];
  let html=defs.map(d=>`<div class="kpi" style="--kc:${d.c}" ${d.money!==undefined?`title="${money(d.money)}"`:''}>
    <div class="kl"><i></i>${d.label}</div><div class="kv" id="${d.id}">0</div><div class="kc">${d.cap}</div>${d.spark}</div>`).join('');
  html+=`<button class="kpi kpi-flag ${a.flagged.length?'hot':''}" style="--kc:var(--red)" data-action="kpiFlags" title="Open flagged rows in Results">
    <div class="kl"><i></i>Red Flags</div><div class="kv" id="kFlag">0</div><div class="kc">${a.counts.Duplicate} dup · ${a.counts.Suspicious} susp · ${a.counts.Verify} verify — click to review</div>${sparkSvg(flagBars.concat(flagBars),'#f4515c','bars')}</button>`;
  $('#kpiRow').innerHTML=html;
  defs.forEach(d=>animateNum($('#'+d.id),d.v,d.fmt));
  animateNum($('#kFlag'),a.flagged.length,v=>String(Math.round(v)));
}
function renderFlagPanel(){
  const a=AGG,open=S.ui.flagsOpen,panel=$('#flagPanel');
  panel.classList.toggle('clear',!a.flagged.length);
  $('#flagHead').classList.toggle('open',open&&a.flagged.length>0);
  $('#flagHead').setAttribute('aria-expanded',open);
  $('#flagCount').textContent=a.flagged.length;
  $('#flagTitle').textContent=a.flagged.length?`${a.flagged.length} flagged employee${a.flagged.length>1?'s':''} need review`:'No flags — all clear';
  $('#flagSub').textContent=a.flagged.length?'Duplicates, suspicious totals & unverified sheets — expand to see who':'Every employee passed duplicate, hours and verification checks';
  const body=$('#flagBody');body.classList.toggle('open',open&&a.flagged.length>0);
  if(!a.flagged.length){body.innerHTML='';return;}
  body.innerHTML=a.flagged.slice(0,60).map(r=>`<div class="frow">
    ${flagCellHtml(r)}
    <div style="min-width:150px"><div class="fname">${esc(r.name)}</div><div class="fid">${esc(r.id)}</div></div>
    <span class="fsite">${esc(r.site)}</span>
    <span class="freason" title="${esc(r.flags.map(f=>f.msg).join('\n'))}">${esc(r.flags.map(f=>f.msg).join(' · '))}</span>
    ${statusBadge(r)}
    <b class="num" style="min-width:90px;text-align:right">${fnum(r.net)}</b>
    <button class="btn btn-sm" data-action="openEmp" data-key="${esc(r.key)}" title="Pay breakdown">${icon('eye')}View</button>
    <button class="btn btn-sm" data-action="openGridFor" data-key="${esc(r.key)}" title="Open in Day Grid">${icon('grid')}</button>
  </div>`).join('');
}
function destroyChart(k){if(RT.charts[k]){try{RT.charts[k].destroy();}catch(e){}delete RT.charts[k];}}
function fbBar(cv,labels,values){const ctx=cv.getContext('2d');const w=cv.parentElement.clientWidth,h=cv.parentElement.clientHeight,dpr=Math.min(2,devicePixelRatio||1);
  cv.width=w*dpr;cv.height=h*dpr;cv.style.width=w+'px';cv.style.height=h+'px';ctx.scale(dpr,dpr);ctx.clearRect(0,0,w,h);
  const max=Math.max(...values,1),pad=26,bw=(w-pad-10)/values.length;
  values.forEach((v,i)=>{const bh=(h-46)*(v/max);ctx.fillStyle=PALETTE[i%PALETTE.length];const x=pad+i*bw+bw*.14;ctx.beginPath();if(ctx.roundRect)ctx.roundRect(x,h-26-bh,bw*.72,Math.max(1,bh),4);else ctx.rect(x,h-26-bh,bw*.72,Math.max(1,bh));ctx.fill();
    ctx.fillStyle=cssVar('--tx3');ctx.font='9px Inter';ctx.textAlign='center';ctx.fillText(labels[i].slice(0,9),x+bw*.36,h-12);});}
function fbDonut(cv,values,colors){const ctx=cv.getContext('2d');const w=cv.parentElement.clientWidth,h=cv.parentElement.clientHeight,dpr=Math.min(2,devicePixelRatio||1);
  cv.width=w*dpr;cv.height=h*dpr;cv.style.width=w+'px';cv.style.height=h+'px';ctx.scale(dpr,dpr);ctx.clearRect(0,0,w,h);
  const tot=values.reduce((a,b)=>a+b,0)||1;let ang=-Math.PI/2;const cx=w/2,cy=h/2,rad=Math.min(w,h)/2-6;
  values.forEach((v,i)=>{const a2=ang+v/tot*Math.PI*2;ctx.beginPath();ctx.arc(cx,cy,rad,ang,a2);ctx.arc(cx,cy,rad*.62,a2,ang,true);ctx.closePath();ctx.fillStyle=colors[i];ctx.fill();ang=a2;});}
function renderCharts(){
  const a=AGG;const topN=+S.ui.barTop||10;const sites=a.bySite.slice(0,topN);
  const gridC=cssVar('--line'),txC=cssVar('--tx2');
  destroyChart('sites');destroyChart('ot');destroyChart('status');
  const otParts=[a.ot,R.reduce((s,r)=>s+r.absDed,0),R.reduce((s,r)=>s+r.pen,0),R.reduce((s,r)=>s+r.advD,0)];
  const otLabels=['OT Pay','Absence Ded.','Penalties','Advances'];const otColors=['#fbbf24','#f4515c','#f472b6','#94a3b8'];
  const stVals=[a.counts.OK,a.counts.Verify,a.counts.Suspicious,a.counts.Duplicate];
  const stLabels=['OK','Verify','Suspicious','Duplicate'];const stColors=['#2fd07c','#fbbf24','#fb7185','#f4515c'];
  if(window.Chart){
    Chart.defaults.font.family="'Inter',system-ui,sans-serif";Chart.defaults.color=txC;
    RT.charts.sites=new Chart($('#chSites'),{type:'bar',data:{labels:sites.map(s=>s.site),datasets:[{data:sites.map(s=>Math.round(s.net)),backgroundColor:sites.map((_,i)=>PALETTE[i%PALETTE.length]),borderRadius:6,maxBarThickness:42}]},
      options:{responsive:true,maintainAspectRatio:false,animation:{duration:500},plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>' Net pay: '+money(c.parsed.y)}}},
      scales:{x:{grid:{display:false},ticks:{maxRotation:45,minRotation:0,font:{size:10}}},y:{grid:{color:gridC},ticks:{callback:v=>v>=1000?(v/1000)+'k':v,font:{size:10}}}}}});
    RT.charts.ot=new Chart($('#chOt'),{type:'doughnut',data:{labels:otLabels,datasets:[{data:otParts.map(v=>Math.round(v)),backgroundColor:otColors,borderColor:cssVar('--bg1'),borderWidth:3,hoverOffset:6}]},
      options:{responsive:true,maintainAspectRatio:false,cutout:'66%',plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>' '+c.label+': '+money(c.parsed)}}}}});
    RT.charts.status=new Chart($('#chStatus'),{type:'doughnut',data:{labels:stLabels,datasets:[{data:stVals,backgroundColor:stColors,borderColor:cssVar('--bg1'),borderWidth:3,hoverOffset:5}]},
      options:{responsive:true,maintainAspectRatio:false,cutout:'68%',plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>' '+c.label+': '+c.parsed+' employees'}}}}});
  }else{
    fbBar($('#chSites'),sites.map(s=>s.site),sites.map(s=>s.net));
    fbDonut($('#chOt'),otParts,otColors);fbDonut($('#chStatus'),stVals,stColors);
  }
  const totOT=otParts.reduce((x,y)=>x+y,0);
  $('#otCenter').innerHTML=`<div><b>${moneyShort(totOT).replace('SAR ','')}</b><span>SAR · OT+Ded</span></div>`;
  $('#otLegend').innerHTML=otLabels.map((l,i)=>`<li><span class="sw" style="background:${otColors[i]}"></span>${l}<span class="lv">${fnum(otParts[i],0)}</span><span class="lp">${totOT?fnum(otParts[i]/totOT*100,0):0}%</span></li>`).join('');
  const totSt=stVals.reduce((x,y)=>x+y,0)||1;
  $('#statusCenter').innerHTML=`<div><b>${a.rowCount}</b><span>rows</span></div>`;
  $('#statusLegend').innerHTML=stLabels.map((l,i)=>`<li><span class="sw" style="background:${stColors[i]}"></span>${l}<span class="lv">${stVals[i]}</span><span class="lp">${fnum(stVals[i]/totSt*100,0)}%</span></li>`).join('');
}
function renderSiteTable(){
  $('#siteTableWrap').innerHTML=`<table class="mini-tbl"><thead><tr><th>Site</th><th>Period</th><th class="r">Emp</th><th class="r">Net Pay</th><th class="r">OT</th><th class="r">Flags</th></tr></thead><tbody>${
    AGG.bySite.map(s=>{const p=periodOf(s.site);return `<tr data-action="siteOpen" data-site="${esc(s.site)}" title="Open ${esc(s.site)} in Results">
      <td><b>${esc(s.site)}</b></td><td class="muted">${p.label}</td><td class="r num">${s.emp}</td>
      <td class="r num"><b>${fnum(s.net,0)}</b></td><td class="r num" style="color:var(--warn)">${fnum(s.ot,0)}</td>
      <td class="r">${s.flags?`<span class="badge b-dup">${icon('flag')}${s.flags}</span>`:`<span class="badge b-ok">${icon('check')}0</span>`}</td></tr>`;}).join('')
  }</tbody></table>`;
}
function renderActivity(){const el=$('#activityList');if(!el)return;
  el.innerHTML=S.activity.slice(0,5).map(x=>`<li><span class="aic">${icon(x.ic||'zap')}</span><span>${esc(x.msg)}</span><time>${timeAgo(x.t)}</time></li>`).join('')||'<li class="muted">No activity yet</li>';}
function renderDash(){renderKpis();renderFlagPanel();renderSiteTable();renderActivity();requestAnimationFrame(renderCharts);}
function renderNavBadges(){const f=AGG?AGG.flagged.length:0;$('#nbFlags').textContent=f||'';
  const unmapped=S.sheets.filter(s=>!s.mapped).length;$('#nbMap').textContent=unmapped||'';
  if($('#fFlagCount'))$('#fFlagCount').textContent=f;}
function renderTopbarBits(){$('#monthPick').value=S.settings.month;
  $('#themeBtn').innerHTML=icon(S.settings.theme==='dark'?'sun':'moon');
  $('#thDark')&&$('#thDark').classList.toggle('btn-p',S.settings.theme==='dark');
  $('#thLight')&&$('#thLight').classList.toggle('btn-p',S.settings.theme==='light');}
function renderAll(){renderNavBadges();renderTopbarBits();
  const map={dashboard:renderDash,results:renderResults,employees:renderEmp,timesheets:renderSheets,grid:renderGrid,templates:renderTpl,export:renderExportSel,settings:renderSettings};
  const fn=map[RT.tab];if(typeof fn==='function')fn();}
function switchTab(t){RT.tab=t;
  $$('.view').forEach(v=>v.classList.toggle('on',v.id==='view-'+t));
  $$('.navbtn[data-tab]').forEach(b=>b.classList.toggle('on',b.dataset.tab===t));
  const m=TAB_META[t]||['',''];$('#pageTitle').textContent=m[0];$('#pageSub').textContent=m[1];
  $('#sidebar').classList.remove('open');$('#scrim').classList.remove('show');
  $('#content').scrollTop=0;if(t!=='grid'&&RT.inspector)closeInspector();renderAll();}
/* ================= RESULTS TABLE & EMPLOYEE MASTER ================= */
function filteredResults(){
  let rows=R;
  if(RT.site!=='all')rows=rows.filter(r=>r.site===RT.site);
  if(RT.q){const q=RT.q.toLowerCase();rows=rows.filter(r=>r.name.toLowerCase().includes(q)||String(r.id).toLowerCase().includes(q));}
  if(RT.flagged)rows=rows.filter(r=>r.sev>0);
  const dir=RT.sortDir==='asc'?1:-1,k=RT.sortKey;
  rows=rows.slice().sort((a,b)=>{const va=colSortVal(a,k),vb=colSortVal(b,k);
    if(va<vb)return -1*dir;if(va>vb)return dir;return b.sev-a.sev||a.name.localeCompare(b.name);});
  return rows;}
function visibleCols(){return COLS.filter(c=>c.always||S.ui.resCols.includes(c.k));}
function fillSiteSelect(el,val,allLabel){const sites=allSites();
  el.innerHTML=`<option value="all">${allLabel}</option>`+sites.map(s=>`<option value="${esc(s)}">${esc(s)}</option>`).join('');
  el.value=sites.includes(val)?val:'all';}
function renderResults(){
  fillSiteSelect($('#fSite'),RT.site,'All sites ('+allSites().length+')');
  if(document.activeElement!==$('#fSearch'))$('#fSearch').value=RT.q;
  $('#fFlagged').classList.toggle('on-flag',RT.flagged);
  $('#pageSize').value=String(S.ui.pageSize);
  $('#colMenu').innerHTML=COLS.map(c=>`<label class="mi"><input type="checkbox" data-bind="colToggle" data-col="${c.k}" ${c.always?'checked disabled':(S.ui.resCols.includes(c.k)?'checked':'')}>${c.label}${c.always?' <span class="muted" style="font-size:10px">pinned</span>':''}</label>`).join('');
  const rows=filteredResults();const cols=visibleCols();
  const size=+S.ui.pageSize||25;const pages=Math.max(1,Math.ceil(rows.length/size));
  RT.page=Math.min(Math.max(1,RT.page),pages);
  const slice=rows.slice((RT.page-1)*size,RT.page*size);
  if(!R.length){$('#resWrap').innerHTML=`<div class="empty">${icon('table')}<b>No payroll yet</b>Load your Employee Master and timesheets — or explore the demo data.<div style="margin-top:14px;display:flex;gap:8px;justify-content:center;flex-wrap:wrap"><button class="btn btn-g" data-action="loadMaster">${icon('upload')}Load Master</button><button class="btn btn-p" data-action="loadSheets">${icon('files')}Load Timesheets</button><button class="btn" data-action="demo">${icon('zap')}Load demo</button></div></div>`;
    $('#resCount').textContent='';$('#pager').innerHTML='';return;}
  const arrow=k=>RT.sortKey===k?`<span class="arr">${RT.sortDir==='asc'?'▲':'▼'}</span>`:'';
  let thead=`<tr>${cols.map(c=>`<th class="sortable ${c.num?'r':''}" data-action="sort" data-k="${c.k}" title="Sort by ${c.label}">${c.label}${arrow(c.k)}</th>`).join('')}<th class="c">Actions</th></tr>`;
  let tbody=slice.map(r=>{
    const cls=r.status==='Duplicate'?'fr-dup':r.status==='Suspicious'?'fr-susp':r.status==='Verify'?'fr-ver':'';
    return `<tr class="${cls}">${cols.map(c=>{
      if(c.k==='flag')return `<td>${flagCellHtml(r)}</td>`;
      if(c.k==='status')return `<td>${statusBadge(r)}</td>`;
      if(c.k==='name')return `<td><b>${esc(r.name)}</b></td>`;
      if(c.k==='id')return `<td class="mono">${esc(r.id)}</td>`;
      if(c.k==='net')return `<td class="r num" style="font-weight:800;${r.net<0?'color:var(--danger)':''}">${fnum(r.net)}</td>`;
      if(c.k==='hl')return `<td style="font-size:11px" class="muted">${esc(hlStr(r))}</td>`;
      if(MONEY_COLS.has(c.k))return `<td class="r num">${fnum(colRaw(r,c.k))}</td>`;
      if(c.num)return `<td class="r num">${colDisplay(r,c.k)}</td>`;
      return `<td>${colDisplay(r,c.k)}</td>`;}).join('')}
      <td class="c" style="white-space:nowrap"><button class="btn btn-sm" data-action="openEmp" data-key="${esc(r.key)}" title="Breakdown & edit">${icon('eye')}</button> <button class="btn btn-sm" data-action="openGridFor" data-key="${esc(r.key)}" title="Day grid">${icon('grid')}</button></td></tr>`;}).join('');
  const sums={};['basic','otH','otD','otPay','abs','absDed','pen','advD','totDed','net'].forEach(k=>sums[k]=rows.reduce((s,r)=>s+(+r[k]||0),0));
  let tfoot=`<tr>${cols.map((c,i)=>{
    if(i===0)return `<td>TOTAL · ${rows.length} rows</td>`;
    if(c.k==='name')return `<td class="muted" style="font-weight:600">${RT.flagged?'flagged only':RT.site==='all'?'all sites':esc(RT.site)}</td>`;
    if(sums[c.k]!==undefined)return `<td class="r num">${fnum(sums[c.k],MONEY_COLS.has(c.k)?2:1)}</td>`;
    return '<td></td>';}).join('')}<td></td></tr>`;
  $('#resWrap').innerHTML=rows.length?`<table class="tbl"><thead>${thead}</thead><tbody>${tbody}</tbody><tfoot>${tfoot}</tfoot></table>`
    :`<div class="empty">${icon('search')}<b>No rows match your filters</b>Try clearing the search or the flagged-only toggle.</div>`;
  const from=rows.length?(RT.page-1)*size+1:0,to=Math.min(rows.length,RT.page*size);
  $('#resCount').innerHTML=`Showing <b>${from}–${to}</b> of <b>${rows.length}</b> rows · <span style="color:var(--danger);font-weight:700">${rows.filter(r=>r.sev>0).length} flagged</span>`;
  let pg=`<button data-action="page" data-p="${RT.page-1}" ${RT.page===1?'disabled':''} aria-label="Previous page">‹</button>`;
  const win=[];for(let p=1;p<=pages;p++){if(p===1||p===pages||Math.abs(p-RT.page)<=2)win.push(p);}
  let last=0;win.forEach(p=>{if(p-last>1)pg+='<span class="muted">…</span>';pg+=`<button data-action="page" data-p="${p}" class="${p===RT.page?'cur':''}">${p}</button>`;last=p;});
  pg+=`<button data-action="page" data-p="${RT.page+1}" ${RT.page===pages?'disabled':''} aria-label="Next page">›</button>`;
  $('#pager').innerHTML=pg;
}
function findResult(key){return R.find(r=>r.key===key);}
function findMaster(id){return S.master.find(e=>String(e.id).trim()===String(id).trim());}

/* ---- employee detail drawer (breakdown + quick edit) ---- */
function openEmpDrawer(key){const r=findResult(key);if(!r)return;const emp=findMaster(r.id);
  const ru=rulesOf(r.site);const absTxt=ru.absRule==='prop'?`Basic ÷ ${r.rates.dim} days`:ru.absRule==='fixed'?`fixed ${fnum(ru.absFixed)} / day`:'no deduction';
  openDrawer(`
  <div class="dhead"><div style="flex:1;min-width:0"><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">${statusBadge(r)}<span class="chip">${esc(r.site)}</span></div>
    <h3 style="font-size:17px;margin-top:8px">${esc(r.name)}</h3><span class="muted mono" style="font-size:12px">${esc(r.id)} · ${esc(r.position)}</span></div>
    <button class="iconbtn" data-action="closeDrawer" aria-label="Close">${icon('x')}</button></div>
  <div class="dbody">
    ${r.flags.length?`<div style="margin-bottom:14px">${r.flags.map(f=>`<div class="issue-row ${f.sev==='ver'?'sev-med':'sev-high'}" style="margin-bottom:6px"><span class="iic">${icon('flag','fill:currentColor;stroke:none;width:13px;height:13px')}</span><div class="ibody"><span>${esc(f.msg)}</span></div></div>`).join('')}</div>`:''}
    <label>Pay breakdown — ${monthLabel()}</label>
    <table class="brk" style="margin:6px 0 16px">
      <tr><td>Basic salary<span class="formula">${emp&&String(emp.payBy).toLowerCase().startsWith('h')&&!emp.basic?`${fnum(emp.rateHour)}/h × ${r.rates.nh}h × ${r.rates.dim}d`:'from Employee Master'}</span></td><td>${fnum(r.basic)}</td></tr>
      <tr><td>OT hours pay<span class="formula">${fnum(r.otH,1)} h × ${fnum(r.rates.otHr)} SAR/h</span></td><td class="money-in">+${fnum(r.otH*r.rates.otHr)}</td></tr>
      <tr><td>OT off-day pay<span class="formula">${fnum(r.otD,1)} off-days × ${fnum(r.rates.otDayRate)} SAR/day</span></td><td class="money-in">+${fnum(r.otD*r.rates.otDayRate)}</td></tr>
      <tr><td>Absence deduction<span class="formula">${r.abs} day(s) × ${fnum(r.rates.absRate)} (${absTxt})</span></td><td class="money-out">−${fnum(r.absDed)}</td></tr>
      <tr><td>Absence penalty<span class="formula">${r.abs} × ${fnum(r.rates.penRate)} SAR</span></td><td class="money-out">−${fnum(r.pen)}</td></tr>
      <tr><td>Advance deduction<span class="formula">${fnum(r.adv.amt)} ÷ ${r.adv.m} month(s)</span></td><td class="money-out">−${fnum(r.advD)}</td></tr>
      <tr class="total"><td>NET PAY</td><td style="color:${r.net<0?'var(--danger)':'var(--green)'}">${money(r.net)}</td></tr>
    </table>
    <label>Worked</label>
    <div style="display:flex;gap:7px;flex-wrap:wrap;margin:6px 0 16px">
      <span class="chip">${workedStr(r)}</span><span class="chip" style="color:var(--warn)">${fnum(r.otH,1)} OT h</span><span class="chip" style="color:var(--danger)">${r.abs} absent</span><span class="chip">${r.rates.len}-day period</span>
    </div>
    <label>Grid highlights</label>
    <div style="display:flex;gap:7px;flex-wrap:wrap;margin:6px 0 16px">
      ${Object.entries({g:'Verified',y:'Review',r:'Problem',b:'OT',k:'Absent'}).map(([c,n])=>r.hl[c]?`<span class="chip"><i style="width:9px;height:9px;border-radius:3px;background:${HL_COLORS[c].css};display:inline-block"></i>${r.hl[c]} ${n}</span>`:'').join('')||'<span class="muted" style="font-size:12px">None yet — paint them in the Day Grid.</span>'}
      ${r.hl.notes?`<span class="chip">${icon('note','width:11px;height:11px')}${r.hl.notes} note(s)</span>`:''}
    </div>
    ${emp?`<label>Quick edit master values</label>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:6px">
      <div class="fld" style="display:flex;flex-direction:column;gap:3px"><label>Basic salary</label><input type="number" id="qeBasic" value="${emp.basic||0}" min="0" step="50"></div>
      <div class="fld" style="display:flex;flex-direction:column;gap:3px"><label>Advance amount</label><input type="number" id="qeAdv" value="${emp.adv||0}" min="0"></div>
      <div class="fld" style="display:flex;flex-direction:column;gap:3px"><label>Advance months</label><input type="number" id="qeAdvM" value="${emp.advM||1}" min="1"></div>
      <div class="fld" style="display:flex;flex-direction:column;gap:3px"><label>Penalty / absence</label><input type="number" id="qePen" value="${emp.pen||0}" min="0"></div>
    </div>`:`<div class="issue-row sev-med"><span class="iic">${icon('alert')}</span><div class="ibody"><b>Not in Employee Master</b><span>Add this employee to calculate a real salary.</span></div></div>`}
  </div>
  <div class="dfoot">
    ${emp?`<button class="btn btn-p" data-action="qeSave" data-id="${esc(emp.id)}">${icon('check')}Save & recalculate</button>
    <button class="btn" data-action="editEmp" data-id="${esc(emp.id)}">${icon('pen')}Full edit</button>`:`<button class="btn btn-p" data-action="adoptEmp" data-key="${esc(r.key)}">${icon('plus')}Add to master</button>`}
    <button class="btn" data-action="openGridFor" data-key="${esc(r.key)}">${icon('grid')}Day grid</button>
  </div>`);}

/* ---- employees view ---- */
function renderEmp(){
  fillSiteSelect($('#empSite'),RT.empSite,'All sites');
  if(document.activeElement!==$('#empSearch'))$('#empSearch').value=RT.empQ;
  const dup={};S.master.forEach(e=>{const k=String(e.id).trim();dup[k]=(dup[k]||0)+1;});
  const dupN=Object.values(dup).filter(v=>v>1).length;
  $('#masterMeta').innerHTML=`${icon('files','width:12px;height:12px')} ${esc(S.masterFile||'No master file loaded')} · <b>${S.master.length}</b> employees${dupN?` · <span style="color:var(--danger)">${dupN} duplicate ID(s)</span>`:''}`;
  let rows=S.master.map((e,i)=>({e,i}));
  if(RT.empSite!=='all')rows=rows.filter(x=>x.e.site===RT.empSite);
  if(RT.empQ){const q=RT.empQ.toLowerCase();rows=rows.filter(x=>x.e.name.toLowerCase().includes(q)||String(x.e.id).toLowerCase().includes(q)||String(x.e.position).toLowerCase().includes(q));}
  if(!S.master.length){$('#empWrap').innerHTML=`<div class="empty">${icon('users')}<b>No Employee Master loaded</b>Download the template, fill it in, and load it here — or add employees manually.<div style="margin-top:14px;display:flex;gap:8px;justify-content:center;flex-wrap:wrap"><button class="btn btn-p" data-action="dlTemplate">${icon('download')}Employee Template.xlsx</button><button class="btn btn-g" data-action="loadMaster">${icon('upload')}Load Master</button></div></div>`;return;}
  $('#empWrap').innerHTML=`<table class="tbl"><thead><tr><th>Employee ID</th><th>Name</th><th>Site</th><th>Position</th><th>Pay By</th><th class="r">Basic</th><th class="r">Rate/Day</th><th class="r">Rate/Hour</th><th class="r">OT ×</th><th class="r">OT Fixed</th><th class="r">DIM</th><th>Off Day</th><th class="r">Advance</th><th class="r">Months</th><th class="r">Penalty</th><th class="c">Actions</th></tr></thead>
  <tbody>${rows.map(({e})=>{const isDup=dup[String(e.id).trim()]>1;
    return `<tr class="${isDup?'fr-dup':''}"><td class="mono">${isDup?`<span class="tflag f-dup" title="Duplicate ID in master">${icon('flag')}</span> `:''}${esc(e.id)}</td><td><b>${esc(e.name)}</b></td><td>${esc(e.site)}</td><td>${esc(e.position)}</td><td>${esc(e.payBy)}</td><td class="r num">${fnum(e.basic,0)}</td><td class="r num">${fnum(e.rateDay,0)}</td><td class="r num">${fnum(e.rateHour,0)}</td><td class="r num">${fnum(e.otMult,1)}</td><td class="r num">${fnum(e.otFixed,0)}</td><td class="r num">${e.dim||'site'}</td><td>${esc(e.offDay||'site')}</td><td class="r num">${fnum(e.adv,0)}</td><td class="r num">${e.advM||1}</td><td class="r num">${fnum(e.pen,0)}</td>
    <td class="c" style="white-space:nowrap"><button class="btn btn-sm" data-action="editEmp" data-id="${esc(e.id)}" title="Edit">${icon('pen')}</button> <button class="btn btn-sm btn-soft-d" data-action="delEmp" data-id="${esc(e.id)}" title="Delete">${icon('trash')}</button></td></tr>`;}).join('')}</tbody></table>`;
}
function editEmpDrawer(id){const e=id?findMaster(id):null;
  const v=k=>e?esc(e[k]??''):'';
  openDrawer(`<div class="dhead"><div style="flex:1"><h3 style="font-size:16px">${e?'Edit employee':'Add employee'}</h3><span class="muted" style="font-size:12px">${e?esc(e.id):'New master record'}</span></div><button class="iconbtn" data-action="closeDrawer" aria-label="Close">${icon('x')}</button></div>
  <div class="dbody"><div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
    ${[['name','Name','text'],['id','Employee ID','text'],['site','Site / Branch','text'],['position','Position','text'],['basic','Basic Salary (SAR)','number'],['payBy','Pay By (Day/Hour)','text'],['rateDay','Rate per Day','number'],['rateHour','Rate per Hour','number'],['otMult','OT Multiplier','number'],['otFixed','OT Fixed Rate','number'],['dim','Days in Month (0 = site)','number'],['offDay','Off Day (e.g. Friday)','text'],['adv','Advance Amount','number'],['advM','Advance Months','number'],['pen','Penalty per Absence','number']].map(([k,l,t])=>`<div class="fld" style="display:flex;flex-direction:column;gap:3px;${k==='name'||k==='site'?'grid-column:span 2':''}"><label>${l}</label><input type="${t}" step="any" id="ef_${k}" value="${v(k)}" ${k==='payBy'?'list="paybyList"':''}></div>`).join('')}
    <datalist id="paybyList"><option>Day</option><option>Hour</option></datalist>
  </div></div>
  <div class="dfoot"><button class="btn btn-p" data-action="saveEmp" data-orig="${e?esc(e.id):''}">${icon('check')}Save employee</button><button class="btn" data-action="closeDrawer">Cancel</button></div>`);}
function saveEmpFromDrawer(orig){
  const g=k=>$('#ef_'+k).value;const num=k=>+g(k)||0;
  const rec={name:g('name').trim(),id:g('id').trim(),site:g('site').trim()||'Unassigned',position:g('position').trim(),basic:num('basic'),payBy:g('payBy')||'Day',rateDay:num('rateDay'),rateHour:num('rateHour'),otMult:num('otMult')||1.5,otFixed:num('otFixed'),dim:num('dim'),offDay:g('offDay').trim(),adv:num('adv'),advM:Math.max(1,num('advM')||1),pen:num('pen')};
  if(!rec.id||!rec.name){toast('Employee ID and Name are required.','err');return;}
  if(orig){const i=S.master.findIndex(e=>String(e.id)===String(orig));if(i>=0)S.master[i]=rec;
    if(orig!==rec.id)S.sheets.forEach(sh=>sh.rows.forEach(r=>{if(String(r.id)===String(orig))r.id=rec.id;}));}
  else S.master.push(rec);
  closeDrawer();act((orig?'Updated employee ':'Added employee ')+rec.name,'users');recompute();toast('Saved — payroll recalculated.','ok');}
/* ================= UPLOAD, MAPPER, REVIEW & FIX ================= */
async function readAoa(file){
  const isCsv=/\.csv$/i.test(file.name);
  if(window.XLSX&&!isCsv){const wb=XLSX.read(await file.arrayBuffer(),{type:'array'});const ws=wb.Sheets[wb.SheetNames[0]];return XLSX.utils.sheet_to_json(ws,{header:1,defval:'',raw:true});}
  if(isCsv||!window.XLSX){if(!isCsv){toast('SheetJS not loaded (offline). Reconnect once, or save the file as .csv.','err');return null;}
    return parseCSV(await file.text());}
  return null;}
function parseCSV(text){const rows=[];let row=[],cur='',q=false;
  for(let i=0;i<text.length;i++){const c=text[i];
    if(q){if(c==='"'){if(text[i+1]==='"'){cur+='"';i++;}else q=false;}else cur+=c;}
    else if(c==='"')q=true;else if(c===','){row.push(cur);cur='';}
    else if(c==='\n'||c==='\r'){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cur);cur='';if(row.some(x=>x!==''))rows.push(row);row=[];}
    else cur+=c;}
  row.push(cur);if(row.some(x=>x!==''))rows.push(row);
  return rows.map(r=>r.map(c=>{const n=Number(c);return c!==''&&isFinite(n)?n:c;}));}
const MASTER_MATCH={name:['name','employeename','fullname','worker','workername','اسم','اسمالموظف'],id:['employeeidiqama','iqama','iqamanumber','اقامه','employeeid','empid','empcode','badgeno','badge','workerid','id','code','رقمالموظف'],site:['sitedepartmentbranch','site','department','branch','client','project','location'],position:['position','trade','jobtitle','designation','job'],basic:['basicsalary','basic','salary'],payBy:['paybydayhour','payby','paytype'],rateDay:['rateperday','dayrate','dailyrate','perday'],rateHour:['rateperhour','hourlyrate','hourrate','perhour'],otMult:['otmultiplier','multiplier','otmult'],otFixed:['otfixedrate','otfixed','fixedotrate','otrate'],dim:['daysinmonth','monthdays','dim'],offDay:['offday','weeklyoff','restday','dayoff'],adv:['advanceamount','advance','adv','loan'],advM:['advancemonthsn','advancemonths','advancemonth','advmonths','months'],pen:['penaltyperabsence','penalty','penaltyabsence'],specId:['specialid','specid','staffid','companyid','internalid','personnelno'],remarks:['remarks','remark','notes','comment','comments','ملاحظات']};
function matchMasterCols(header){const norm=header.map(h=>normKey(h));const map={};
  for(const f of MASTER_FIELDS){const cands=MASTER_MATCH[f];let idx=-1;
    for(const c of cands){idx=norm.findIndex(h=>h===c);if(idx>=0)break;}
    if(idx<0)for(const c of cands){idx=norm.findIndex(h=>h&&h.includes(c));if(idx>=0)break;}
    map[f]=idx;}
  return map;}
function detectHeaderRow(aoa,dayMode){let best=0,bs=-1;
  for(let r=0;r<Math.min(8,aoa.length);r++){let sc=0;(aoa[r]||[]).forEach(c=>{const k=normKey(c);
    if(dayMode){if(/^(day)?\d{1,2}$/.test(k)||/^d\d{1,2}$/.test(k))sc+=2;if(/id|code|badge|name/.test(k))sc+=2;}
    else{for(const f in MASTER_MATCH)if(MASTER_MATCH[f].includes(k)){sc+=2;break;}}});
    if(sc>bs){bs=sc;best=r;}}
  return best;}
const isDayHead=h=>{const k=normKey(h);return /^(day)?\d{1,2}$/.test(k)||/^d\d{1,2}$/.test(k);};
function autoDetect(aoa,h){const head=aoa[h]||[];const norm=head.map(x=>normKey(x));
  let idCol=norm.findIndex(k=>/^(employeeid|empid|empcode|badgeno|badge|workerid|id|code)$/.test(k));
  if(idCol<0)idCol=norm.findIndex(k=>k.includes('id')||k.includes('code')||k.includes('badge'));
  let nameCol=norm.findIndex(k=>/name|اسم/.test(k));
  let dayFrom=-1,dayTo=-1;
  for(let i=0;i<head.length;i++){if(isDayHead(head[i])){if(dayFrom<0)dayFrom=i;dayTo=i;}else if(dayFrom>=0&&dayTo>=i-1&&norm[i]===''){dayTo=i;}else if(dayFrom>=0&&norm[i]!=='')break;}
  if(dayFrom<0&&idCol>=0){ // fallback: numeric-heavy columns after id/name
    const start=Math.max(idCol,nameCol)+1;let cnt=0;
    for(let i=start;i<head.length;i++){const colVals=aoa.slice(h+1,h+8).map(r=>r[i]);
      if(colVals.some(v=>v!==''&&isFinite(Number(v)))||colVals.every(v=>v==='')){if(dayFrom<0)dayFrom=i;dayTo=i;cnt++;}else if(dayFrom>=0)break;}
    if(cnt<5)dayFrom=dayTo=-1;}
  return{idCol,nameCol,dayFrom,dayTo};}
function guessSite(fileName){let s=fileName.replace(/\.[^.]+$/,'').replace(/[_\-]+/g,' ');
  s=s.replace(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b/gi,'').replace(/\b20\d{2}\b/g,'').replace(/\b(timesheet|time sheet|attendance|sheet|payroll|final|copy)\b/gi,'').replace(/\d+/g,'').replace(/\s+/g,' ').trim();
  if(!s)s=fileName.replace(/\.[^.]+$/,'');
  const known=Object.keys(S.mappings).find(k=>normKey(k)===normKey(s));return known||s;}
function parseSheetRows(sh,issues){const m=S.mappings[sh.site];if(!m||!sh.raw){sh.mapped=false;return;}
  const ru=rulesOf(sh.site);const per=periodOf(sh.site);
  const from=m.dayFrom,to=Math.min(m.dayFrom+per.len-1,(sh.raw[m.headerRow]||[]).length-1);
  m.dayTo=to;sh.rows=[];
  const masterIds=new Set(S.master.map(e=>String(e.id).trim()));
  sh.raw.slice(m.headerRow+1).forEach((r,ri)=>{
    const id=String(r[m.idCol]??'').trim();if(!id)return;
    const name=String(r[m.nameCol]??'').trim();
    if(/^(total|grand total|合计|المجموع)/i.test(id)||/^(total|grand total)/i.test(name))return;
    const d=[];for(let i=from;i<=to;i++){let v=r[i];d.push(v===undefined?'':v);}
    sh.rows.push({id,name,d});
    if(issues){
      if(!masterIds.has(id)&&issues.length<60)issues.push({sev:'med',title:`Unknown ID ${id} — ${sh.site}`,detail:`"${name||'no name'}" is in the timesheet but not in the Employee Master. Pay can't be calculated until fixed.`,fix:{label:'Add to master',fn:()=>{S.master.push({id,name:name||'Employee '+id,site:sh.site,position:'—',basic:0,payBy:'Day',rateDay:0,rateHour:0,otMult:1.5,otFixed:0,dim:0,offDay:'',adv:0,advM:1,pen:0});}}});
      d.forEach((v,di)=>{const c=parseCell(v,ru);
        if(c.h!==null&&c.h>24&&issues.length<60)issues.push({sev:'high',title:`Day ${di+1}: ${c.h} h — ${name||id} (${sh.site})`,detail:'A single day cannot exceed 24 hours.',fix:{label:'Cap at 24',fn:()=>{const row=sh.rows.find(x=>x.id===id);if(row)row.d[di]=24;}}});
        else if(c.bad&&issues.length<60)issues.push({sev:'med',title:`Unreadable value "${String(v).slice(0,12)}" — day ${di+1}, ${name||id}`,detail:`${sh.site}: not a number and not a known code (A / OFF / P).`,fix:{label:'Clear cell',fn:()=>{const row=sh.rows.find(x=>x.id===id);if(row)row.d[di]='';}}});});
    }});
  sh.mapped=true;}

async function handleMasterFile(file){
  const aoa=await readAoa(file);if(!aoa||!aoa.length){toast('Could not read '+file.name,'err');return;}
  const h=detectHeaderRow(aoa,false);const map=matchMasterCols(aoa[h]||[]);
  if(map.id<0||map.name<0){toast('Could not find "Employee ID" and "Name" columns in '+file.name+'. Use the template format.','err');return;}
  const issues=[];const prev=S.master.slice();const prevFile=S.masterFile;const list=[];const seen={};
  aoa.slice(h+1).forEach((r,ri)=>{
    const id=String(r[map.id]??'').trim();const name=String(r[map.name]??'').trim();
    if(!id&&!name)return;
    const num=i=>{if(i<0)return 0;const v=r[i];if(v===''||v===undefined)return 0;const n=Number(String(v).replace(/[^\d.\-]/g,''));if(!isFinite(n)){if(issues.length<60)issues.push({sev:'med',title:`Invalid number "${String(v).slice(0,14)}" — ${name||id}`,detail:`Master row ${ri+h+2}: treated as 0.`,fix:{label:'OK, use 0',fn:()=>{}}});return 0;}return n;};
    const rec={name:name||'Employee '+id,id:id||'TMP-'+(ri+1),site:map.site>=0?String(r[map.site]??'').trim()||'Unassigned':'Unassigned',position:map.position>=0?String(r[map.position]??'').trim():'',basic:num(map.basic),payBy:map.payBy>=0&&String(r[map.payBy]).toLowerCase().startsWith('h')?'Hour':'Day',rateDay:num(map.rateDay),rateHour:num(map.rateHour),otMult:num(map.otMult)||1.5,otFixed:num(map.otFixed),dim:num(map.dim),offDay:map.offDay>=0?String(r[map.offDay]??'').trim():'',adv:num(map.adv),advM:Math.max(1,num(map.advM)||1),pen:num(map.pen)};
    if(!id)issues.push({sev:'med',title:`Missing Employee ID — "${name}" (row ${ri+h+2})`,detail:`Temporary ID ${rec.id} assigned.`,fix:{label:'Keep temp ID',fn:()=>{}}});
    if(seen[rec.id])issues.push({sev:'high',title:`Duplicate ID ${rec.id} in master`,detail:`"${rec.name}" duplicates an earlier row. Both rows are flagged red in Results.`,fix:{label:'Remove this row',fn:()=>{const i=S.master.lastIndexOf(rec);if(i>=0)S.master.splice(i,1);}}});
    seen[rec.id]=true;
    if(!rec.basic&&!rec.rateDay&&!rec.rateHour)issues.push({sev:'med',title:`No salary/rate — ${rec.name} (${rec.id})`,detail:'Basic, Rate/Day and Rate/Hour are all empty; pay will calculate as 0.',fix:{label:'Set later',fn:()=>{}}});
    list.push(rec);});
  if(!list.length){toast('No employee rows found in '+file.name,'err');return;}
  S.master=list;S.masterFile=file.name;
  S.sheets.forEach(sh=>{if(sh.mapped)parseSheetRows(sh,null);});
  recompute();act(`Employee master loaded · ${list.length} employees`,'users');
  toast(`Master loaded: ${list.length} employees.`,'ok',{label:'Undo',fn:()=>{S.master=prev;S.masterFile=prevFile;recompute();toast('Previous master restored.','ok');}});
  RT.issues=RT.issues.concat(issues);
  if(!RT.mapQueue.length)showIssuesModal();}

async function handleSheetFiles(files){
  const issues=[];let replaced=0;
  for(const file of files){
    const aoa=await readAoa(file);if(!aoa||!aoa.length){toast('Could not read '+file.name,'err');continue;}
    const site=guessSite(file.name);
    const raw=aoa.slice(0,160);
    let sh=S.sheets.find(x=>x.site===site);
    if(sh){replaced++;sh.raw=raw;sh.fileName=file.name;sh.month=S.settings.month;}
    else{sh={key:uid(),fileName:file.name,site,month:S.settings.month,rows:[],raw,mapped:false};S.sheets.push(sh);}
    if(S.mappings[site]){const m=S.mappings[site];
      if(m.headerRow>=raw.length)m.headerRow=detectHeaderRow(raw,true);
      parseSheetRows(sh,issues);
    }else{
      const h=detectHeaderRow(raw,true);const det=autoDetect(raw,h);
      sh._draft=Object.assign({site,headerRow:h,rules:Object.assign({},DEFAULT_RULES)},det);
      if(det.idCol>=0&&det.nameCol>=0&&det.dayFrom>=0){
        S.mappings[site]={idCol:det.idCol,nameCol:det.nameCol,dayFrom:det.dayFrom,dayTo:det.dayTo,headerRow:h,rules:Object.assign({},DEFAULT_RULES)};
        parseSheetRows(sh,issues);sh._needsReview=true;RT.mapQueue.push(sh.key);
      }else{sh.mapped=false;RT.mapQueue.push(sh.key);}
    }}
  recompute();
  act(`${files.length} timesheet file(s) loaded${replaced?` · ${replaced} replaced`:''}`,'files');
  toast(`${files.length} timesheet(s) loaded.`,'ok');
  RT.issues=RT.issues.concat(issues);
  processMapQueue();}
function processMapQueue(){
  if(RT.mapQueue.length){const key=RT.mapQueue[0];const sh=S.sheets.find(x=>x.key===key);
    if(sh){openMapper(sh,true);return;}}
  showIssuesModal();}
function showIssuesModal(){
  const list=RT.issues;if(!list.length){closeModal();return;}
  const high=list.filter(i=>i.sev==='high').length;
  openModal(`<header>${icon('alert','color:var(--warn)')}<h3>Upload check — ${list.length} issue${list.length>1?'s':''} found</h3></header>
  <p style="font-size:12.5px;color:var(--tx2);margin-bottom:12px">${high?`<b style="color:var(--danger)">${high} serious</b> · `:''}Fix them now while uploading, or continue — everything stays flagged in the Results table either way.</p>
  <div style="max-height:46vh;overflow-y:auto" id="issueList">${list.map((it,i)=>issueRowHtml(it,i)).join('')}</div>
  <div class="mfoot"><button class="btn" data-action="issuesClose">Continue anyway</button><button class="btn btn-p" data-action="issuesAutoFix">${icon('zap')}Auto-fix all & continue</button></div>`,true);
  $('#modalBox').style.maxWidth='640px';}
function issueRowHtml(it,i){return `<div class="issue-row sev-${it.sev} ${it.fixed?'fixed':''}" id="iss-${i}">
  <span class="iic">${icon(it.fixed?'check':'alert')}</span>
  <div class="ibody"><b>${esc(it.title)}</b><span>${esc(it.detail)}</span></div>
  ${it.fixed?'<span class="badge b-ok">Fixed</span>':`<button class="btn btn-sm" data-action="issueFix" data-i="${i}">${esc(it.fix.label)}</button>`}</div>`;}
function fixIssue(i,silent){const it=RT.issues[i];if(!it||it.fixed)return;
  try{it.fix.fn();}catch(e){}it.fixed=true;
  const el=$('#iss-'+i);if(el)el.outerHTML=issueRowHtml(it,i);
  recompute();if(!silent)toast('Fixed: '+it.title,'ok');}

/* ---- mapper modal ---- */
function openMapper(sh,fromQueue){
  const m=S.mappings[sh.site];const ru=m?m.rules:(sh._draft?sh._draft.rules:DEFAULT_RULES);
  RT.mapCur={key:sh.key,fromQueue:!!fromQueue,draft:{
    site:sh.site,headerRow:m?m.headerRow:(sh._draft?sh._draft.headerRow:0),
    idCol:m?m.idCol:(sh._draft?sh._draft.idCol:-1),nameCol:m?m.nameCol:(sh._draft?sh._draft.nameCol:-1),
    dayFrom:m?m.dayFrom:(sh._draft?sh._draft.dayFrom:-1),dayTo:m?m.dayTo:(sh._draft?sh._draft.dayTo:-1),
    rules:Object.assign({},DEFAULT_RULES,ru)}};
  const d=RT.mapCur.draft;const raw=sh.raw||[];const heads=raw[d.headerRow]||[];
  const colOpts=sel=>heads.map((h,i)=>`<option value="${i}" ${i===sel?'selected':''}>${String.fromCharCode(65+i%26)} — ${esc(String(h).slice(0,18)||'(blank)')}</option>`).join('');
  openModal(`<header>${icon('map','color:var(--purple)')}<h3>Map columns & site rules</h3><span class="chip">${esc(sh.fileName)}</span>${fromQueue&&RT.mapQueue.length>1?`<span class="chip">${RT.mapQueue.length} files to map</span>`:''}</header>
  <div class="mapper-grid">
    <div class="mform">
      <div class="fld"><label>Site name (mapping is saved under this name)</label><input data-bind="map" data-f="site" value="${esc(d.site)}"></div>
      <div class="row2">
        <div class="fld"><label>Header row</label><select data-bind="map" data-f="headerRow">${raw.slice(0,8).map((r,i)=>`<option value="${i}" ${i===d.headerRow?'selected':''}>Row ${i+1}</option>`).join('')}</select></div>
        <div class="fld"><label>Employee ID column</label><select data-bind="map" data-f="idCol"><option value="-1">—</option>${colOpts(d.idCol)}</select></div>
      </div>
      <div class="row2">
        <div class="fld"><label>Name column</label><select data-bind="map" data-f="nameCol"><option value="-1">—</option>${colOpts(d.nameCol)}</select></div>
        <div class="fld"><label>Count type</label><select data-bind="maprule" data-f="count"><option value="hours" ${d.rules.count==='hours'?'selected':''}>Hours</option><option value="days" ${d.rules.count==='days'?'selected':''}>Days</option><option value="both" ${d.rules.count==='both'?'selected':''}>Both</option></select></div>
      </div>
      <div class="row2">
        <div class="fld"><label>Day columns — from</label><select data-bind="map" data-f="dayFrom"><option value="-1">—</option>${colOpts(d.dayFrom)}</select></div>
        <div class="fld"><label>to (auto-extends to period)</label><select data-bind="map" data-f="dayTo"><option value="-1">—</option>${colOpts(d.dayTo)}</select></div>
      </div>
      <div class="sect">Site pay rules</div>
      <div class="row2">
        <div class="fld"><label>Normal hours / day</label><input type="number" min="1" max="12" data-bind="maprule" data-f="nh" value="${d.rules.nh}"></div>
        <div class="fld"><label>OT rate / hour (SAR, 0 = auto)</label><input type="number" min="0" step="0.5" data-bind="maprule" data-f="otHr" value="${d.rules.otHr}"></div>
      </div>
      <div class="row2">
        <div class="fld"><label>OT rate / off-day (SAR, 0 = auto)</label><input type="number" min="0" step="5" data-bind="maprule" data-f="otDay" value="${d.rules.otDay}"></div>
        <div class="fld"><label>Penalty per absence (SAR)</label><input type="number" min="0" data-bind="maprule" data-f="pen" value="${d.rules.pen}"></div>
      </div>
      <div class="fld"><label>Absence deduction rule</label><select data-bind="maprule" data-f="absRule">
        <option value="prop" ${d.rules.absRule==='prop'?'selected':''}>Basic ÷ days in month × absent days</option>
        <option value="fixed" ${d.rules.absRule==='fixed'?'selected':''}>Fixed amount per absent day</option>
        <option value="none" ${d.rules.absRule==='none'?'selected':''}>No deduction</option></select></div>
      <div class="row2">
        <div class="fld"><label>Fixed absence amount (SAR)</label><input type="number" min="0" data-bind="maprule" data-f="absFixed" value="${d.rules.absFixed}"></div>
        <div class="fld"><label>Days in month</label><select data-bind="maprule" data-f="dim">${[28,29,30,31].map(n=>`<option ${d.rules.dim===n?'selected':''}>${n}</option>`).join('')}</select></div>
      </div>
      <div class="row2">
        <div class="fld"><label>Pay period start day</label><input type="number" min="1" max="28" list="startDays" data-bind="maprule" data-f="start" value="${d.rules.start}"><datalist id="startDays"><option>1</option><option>21</option><option>25</option><option>26</option></datalist></div>
        <div class="fld"><label>Weekly off day</label><select data-bind="maprule" data-f="offDay">${['Friday','Saturday','Sunday','Monday','None'].map(o=>`<option ${d.rules.offDay===o?'selected':''}>${o}</option>`).join('')}</select></div>
      </div>
    </div>
    <div>
      <label>File preview — <span style="color:var(--cyan)">ID</span> · <span style="color:var(--purple)">Name</span> · <span style="color:var(--info)">Day columns</span></label>
      <div class="rawprev" id="rawPrev" style="margin-top:5px"></div>
      <p class="muted" style="font-size:11px;margin-top:8px">Day columns auto-extend to the site's pay period length. Absence codes: A / ABS / غياب · off days: OFF / R / راحة · P = present (normal hours).</p>
    </div>
  </div>
  <div class="mfoot">
    <button class="btn" data-action="mapAuto">${icon('zap')}Auto-detect</button>
    <span class="spacer"></span>
    <button class="btn" data-action="mapCancel">Cancel</button>
    <button class="btn btn-p" data-action="mapSave">${icon('check')}Save mapping & calculate</button>
  </div>`,true);
  renderRawPrev();}
function renderRawPrev(){const mc=RT.mapCur;if(!mc)return;const sh=S.sheets.find(x=>x.key===mc.key);if(!sh)return;
  const d=mc.draft;const raw=sh.raw||[];const heads=raw[d.headerRow]||[];
  const cls=i=>i===d.idCol?'mc-id':i===d.nameCol?'mc-name':(d.dayFrom>=0&&i>=d.dayFrom&&i<=(d.dayTo>=0?d.dayTo:d.dayFrom))?'mc-day':'mc-dim';
  $('#rawPrev').innerHTML=`<table><thead><tr>${heads.map((h,i)=>`<th class="${cls(i)}">${String.fromCharCode(65+i%26)}<br>${esc(String(h).slice(0,14))}</th>`).join('')}</tr></thead>
  <tbody>${raw.slice(d.headerRow+1,d.headerRow+9).map(r=>`<tr>${heads.map((h,i)=>`<td class="${cls(i)}">${esc(String(r[i]??'').slice(0,14))}</td>`).join('')}</tr>`).join('')}</tbody></table>`;}
function saveMapping(){const mc=RT.mapCur;if(!mc)return;const sh=S.sheets.find(x=>x.key===mc.key);if(!sh)return;
  const d=mc.draft;
  if(d.idCol<0||d.nameCol<0||d.dayFrom<0){toast('Pick at least the ID, Name and first Day column.','err');return;}
  const site=String(d.site).trim()||sh.site;
  const oldSite=sh.site;sh.site=site;
  S.mappings[site]={idCol:d.idCol,nameCol:d.nameCol,dayFrom:d.dayFrom,dayTo:d.dayTo>=0?d.dayTo:d.dayFrom,headerRow:d.headerRow,rules:Object.assign({},d.rules)};
  if(oldSite!==site&&S.mappings[oldSite]&&!S.sheets.some(x=>x!==sh&&x.site===oldSite))delete S.mappings[oldSite];
  const issues=[];parseSheetRows(sh,issues);RT.issues=RT.issues.concat(issues);
  act(`Mapping saved for ${site} (${d.rules.count}, ${d.rules.nh}h, start ${d.rules.start})`,'map');
  if(mc.fromQueue){RT.mapQueue=RT.mapQueue.filter(k=>k!==sh.key);}
  RT.mapCur=null;closeModal();recompute();toast(`Mapping saved for ${site} — remembered next month.`,'ok');
  if(mc.fromQueue)processMapQueue();}

/* ---- timesheets view ---- */
function renderSheets(){
  $('#sheetCount').textContent=S.sheets.length+' files · '+S.sheets.filter(s=>s.mapped).length+' mapped';
  if(!S.sheets.length){$('#sheetList').innerHTML=`<div class="empty" style="grid-column:1/-1">${icon('files')}<b>No timesheets loaded</b>Drop your 25 site files above — each layout is mapped once and remembered.</div>`;return;}
  $('#sheetList').innerHTML=S.sheets.map(sh=>{const ru=rulesOf(sh.site);const per=periodOf(sh.site);
    const flags=R.filter(r=>r.site===sh.site&&r.sev>0).length;
    return `<div class="filecard ${sh.mapped?'':'needs-map'}">
    <div class="fname">${icon('files','color:var(--blue);width:15px;height:15px')}<span style="flex:1">${esc(sh.fileName)}</span>${sh.mapped?`<span class="badge b-ok">${icon('check')}Mapped</span>`:`<span class="badge b-ver">${icon('alert')}Needs mapping</span>`}</div>
    <div style="font-weight:700;font-size:13px;color:var(--purple)">${esc(sh.site)}</div>
    <div class="fmeta"><span>${sh.rows.length} employees</span><span>${per.label}</span><span>${ru.count} · ${ru.nh}h/day</span><span>start ${ru.start}</span>${flags?`<span style="color:var(--danger);font-weight:700">${flags} flagged</span>`:''}</div>
    <div class="fbtns">
      <button class="btn btn-sm ${sh.mapped?'':'btn-p'}" data-action="mapSite" data-key="${sh.key}">${icon('map')}${sh.mapped?'Rules / remap':'Map columns'}</button>
      <button class="btn btn-sm" data-action="gridSite" data-key="${sh.key}" ${sh.mapped?'':'disabled'}>${icon('grid')}Day grid</button>
      <span class="spacer"></span>
      <button class="btn btn-sm btn-soft-d" data-action="removeSheet" data-key="${sh.key}" title="Remove file">${icon('trash')}</button>
    </div></div>`;}).join('');}
function downloadMasterTemplate(){exportAoa([MASTER_HEADERS],'Employee Template',[22,14,26,16,13,16,12,12,13,13,13,12,15,15,18]);
  act('Employee Template.xlsx downloaded','download');toast('Employee Template downloaded — fill it and load it back.','ok');}
/* ================= DAY GRID & HIGHLIGHTS ================= */
const BRUSHES=[['inspect','Inspect','var(--blue)'],['r','Problem','#c62833'],['y','Review','#d19a12'],['g','Verified','#1d9e5f'],['b','OT day','#2563d9'],['k','Absent','#111318'],['erase','Eraser','transparent'],['note','Note','transparent']];
function gridSheet(){return S.sheets.find(s=>s.key===RT.gSite)||S.sheets.find(s=>s.mapped)||null;}
function cellAutoClass(type){return type==='off'?'auto-off':type==='abs'?'auto-abs':(type==='ot'||type==='offwork')?'auto-ot':'';}
function cellLabel(raw){if(raw===''||raw===null||raw===undefined)return '·';if(typeof raw==='number')return String(Math.round(raw*100)/100);return esc(String(raw).slice(0,4));}
function renderBrushes(){$('#brushes').innerHTML=BRUSHES.map(([c,n,css])=>`<button class="brush ${RT.gBrush===c?'on':''}" style="--bc:${c==='erase'||c==='note'?'var(--tx2)':css}" data-action="brush" data-c="${c}" title="${c==='inspect'?'Click a cell to inspect & edit it':''+n+' tool'}">
  ${c==='inspect'?icon('eye','width:12px;height:12px'):c==='erase'?icon('eraser','width:12px;height:12px'):c==='note'?icon('note','width:12px;height:12px'):`<span class="bsw" style="background:${css};${c==='k'?'border:1px solid var(--line2)':''}"></span>`}${n}</button>`).join('');}
function renderGrid(){
  const sel=$('#gSite');const mapped=S.sheets.filter(s=>s.mapped);
  sel.innerHTML=mapped.map(s=>`<option value="${s.key}">${esc(s.site)} — ${esc(s.fileName)}</option>`).join('')||'<option>No mapped timesheets</option>';
  renderBrushes();
  const sh=gridSheet();
  if(!sh){$('#gPeriod').textContent='—';$('#gridWrap').innerHTML=`<div class="empty">${icon('grid')}<b>No mapped timesheet to show</b>Load timesheets and map their columns first.<div style="margin-top:12px"><button class="btn btn-p" data-action="loadSheets">${icon('files')}Load timesheets</button></div></div>`;$('#gBulk').classList.remove('show');return;}
  RT.gSite=sh.key;sel.value=sh.key;
  const ru=rulesOf(sh.site),per=periodOf(sh.site),hl=hlMap(sh.site),offIdx=WD_IDX[String(ru.offDay).toLowerCase()]??5;
  $('#gPeriod').textContent=`${per.label} · ${per.len} days`;
  let rows=sh.rows.map(row=>({row,r:R.find(x=>x.sheetKey===sh.key&&x.id===String(row.id).trim())}));
  const rowHas=(row,c)=>{for(let i=0;i<per.len;i++){const h=hl[row.id+'|'+i];if(h&&h.c===c)return true;}return false;};
  if(RT.gFilter==='flagged')rows=rows.filter(({row,r})=>rowHas(row,'r')||rowHas(row,'y')||(r&&r.sev>0));
  if(RT.gFilter==='unverified')rows=rows.filter(({row})=>{let g=0,y=0;for(let i=0;i<per.len;i++){const h=hl[row.id+'|'+i];if(h){if(h.c==='g')g++;if(h.c==='y')y++;}}return g===0||y>0;});
  $('#gFilter').value=RT.gFilter;
  const head=`<tr><th class="empth"><label style="display:flex;gap:8px;align-items:center;cursor:pointer"><input type="checkbox" data-bind="gSelAll" aria-label="Select all rows">Employee</label></th>${
    per.dates.map((dt,i)=>`<th class="${dt.getDay()===offIdx?'offday':''}" title="${WD[dt.getDay()]} ${dt.getDate()} ${MON[dt.getMonth()]}">${dt.getDate()}<span class="wd">${WD[dt.getDay()][0]}</span></th>`).join('')}</tr>`;
  const body=rows.map(({row,r})=>{
    const days=r?r.days:[];
    return `<tr id="grow-${esc(row.id)}"><td class="empth"><label style="display:flex;gap:8px;align-items:center;cursor:pointer"><input type="checkbox" data-bind="gSel" data-id="${esc(row.id)}" ${RT.gSel.has(row.id)?'checked':''} aria-label="Select ${esc(row.name)}"><span style="min-width:0"><span style="display:flex;gap:5px;align-items:center">${r&&r.sev>0?`<span class="tflag ${r.sev>=2?'f-dup':'f-ver'}" title="${esc(r.flags.map(f=>f.short).join(', '))}">${icon('flag')}</span>`:''}${esc(row.name||row.id)}</span><small>${esc(row.id)}${r?' · '+fnum(r.net,0)+' SAR':''}</small></span></label></td>${
      per.dates.map((dt,i)=>{const h=hl[row.id+'|'+i];const dd=days[i];const type=dd?dd.type:'blank';
        const title=`${WD[dt.getDay()]} ${dt.getDate()} ${MON[dt.getMonth()]} — ${type==='abs'?'Absent':type==='off'?'Off day':type==='offwork'?'Off-day work (OT)':type==='ot'?'Overtime':type==='bad'?'Unreadable value':type==='normal'?'Normal':'—'}${h&&h.n?'\nNote: '+h.n:''}${h?'\nHighlight: '+HL_COLORS[h.c].n:''}`;
        return `<td class="gcell ${h?'hl-'+h.c:cellAutoClass(type)}" data-cell="${esc(row.id)}|${i}" title="${esc(title)}">${cellLabel(row.d[i])}${h&&h.n?'<span class="ndot"></span>':''}</td>`;}).join('')}</tr>`;}).join('');
  $('#gridWrap').innerHTML=rows.length?`<table class="gtable"><thead>${head}</thead><tbody>${body}</tbody></table>`
    :`<div class="empty">${icon('search')}<b>No rows match this filter</b>Switch “Show rows” back to all employees.</div>`;
  updateBulkBar();markInspecting();
  if(RT.gFocus){const tr=document.getElementById('grow-'+RT.gFocus);if(tr){tr.scrollIntoView({block:'center',behavior:'smooth'});tr.querySelectorAll('.gcell').forEach(td=>{td.style.transition='none';td.style.filter='brightness(1.8)';setTimeout(()=>{td.style.filter='';},900);});}RT.gFocus=null;}
}
function updateBulkBar(){const n=RT.gSel.size;$('#gBulk').classList.toggle('show',n>0);$('#gBulkCount').textContent=n+' row'+(n===1?'':'s')+' selected';}
function paintCell(id,di){
  const sh=gridSheet();if(!sh)return;const hl=hlMap(sh.site);const key=id+'|'+di;const b=RT.gBrush;
  if(b==='note'){openNoteModal(id,di);return;}
  if(b==='erase')delete hl[key];
  else hl[key]=Object.assign({},hl[key],{c:b});
  const td=document.querySelector(`[data-cell="${CSS.escape(id)}|${di}"]`);
  if(td){const h=hl[key];const sh2=sh;const r=R.find(x=>x.sheetKey===sh2.key&&x.id===id);const type=r&&r.days[di]?r.days[di].type:'blank';
    td.className='gcell '+(h?'hl-'+h.c:cellAutoClass(type));
    td.querySelector('.ndot')?.remove();if(h&&h.n)td.insertAdjacentHTML('beforeend','<span class="ndot"></span>');}
  save();
}
function afterPaint(){computeAll();renderNavBadges();if(RT.inspector)markInspecting();}
function openNoteModal(id,di){const sh=gridSheet();const hl=hlMap(sh.site);const h=hl[id+'|'+di]||{};
  const row=sh.rows.find(r=>r.id===id);const per=periodOf(sh.site);const dt=per.dates[di];
  openModal(`<header>${icon('note','color:var(--info)')}<h3>Cell note</h3></header>
  <p style="font-size:12.5px;color:var(--tx2);margin-bottom:10px"><b>${esc(row?row.name:id)}</b> · ${WD[dt.getDay()]} ${dt.getDate()} ${MON[dt.getMonth()]} · value: <b>${esc(String(row?row.d[di]:'')||'—')}</b></p>
  <textarea id="noteText" rows="3" style="width:100%" placeholder="e.g. Missing punch-out — ask supervisor">${esc(h.n||'')}</textarea>
  <div style="display:flex;gap:6px;margin-top:10px;flex-wrap:wrap">${Object.entries(HL_COLORS).map(([c,o])=>`<button class="brush ${ (h.c||'y')===c?'on':''}" style="--bc:${o.css}" data-action="noteColor" data-c="${c}"><span class="bsw" style="background:${o.css}"></span>${o.n}</button>`).join('')}</div>
  <div class="mfoot"><button class="btn btn-soft-d" data-action="noteDelete" data-id="${esc(id)}" data-di="${di}">Remove</button><span class="spacer"></span><button class="btn" data-action="closeModal">Cancel</button><button class="btn btn-p" data-action="noteSave" data-id="${esc(id)}" data-di="${di}">${icon('check')}Save note</button></div>`);
  RT.noteColor=h.c||'y';
  $$('#modalBox [data-action="noteColor"]').forEach(b=>b.classList.toggle('on',b.dataset.c===RT.noteColor));}
function bulkApply(c){const sh=gridSheet();if(!sh)return;const per=periodOf(sh.site);const hl=hlMap(sh.site);let n=0;
  RT.gSel.forEach(id=>{for(let i=0;i<per.len;i++){const key=id+'|'+i;if(c===null){if(hl[key]){delete hl[key].c;if(!hl[key].n)delete hl[key];}}else hl[key]=Object.assign({},hl[key],{c});}n++;});
  act(`${c==='g'?'Verified':c==='r'?'Flagged':'Cleared'} ${n} row(s) in ${sh.site} grid`,c==='g'?'check':'flag');
  recompute();renderGrid();toast(c===null?'Highlights cleared for selected rows.':c==='g'?`${n} row(s) marked verified.`:`${n} row(s) flagged red.`,c==='r'?'warn':'ok');}
function openGridFor(key){const r=findResult(key);if(!r)return;
  const sh=S.sheets.find(s=>s.key===r.sheetKey)||S.sheets.find(s=>s.site===r.site&&s.mapped);
  if(!sh){toast('No mapped timesheet for '+r.site+' yet.','warn');return;}
  RT.gSite=sh.key;RT.gFocus=r.id;RT.gFilter='all';closeDrawer();switchTab('grid');}
/* ================= CELL INSPECTOR & DRAGGABLE PANELS ================= */
const INS_CLASS={normal:['Normal day','var(--tx2)'],ot:['Overtime day','var(--info)'],offwork:['Off-day work / OT','var(--purple)'],
  off:['Weekly off day','var(--purple)'],abs:['Absent','var(--danger)'],blank:['No entry','var(--tx3)'],bad:['Unreadable value','var(--warn)']};
function inspPref(){return S.ui.inspector;}
function placeInspector(){const p=$('#inspector'),st=inspPref();
  const w=Math.min(Math.max(290,+(st.w||340)),Math.min(560,innerWidth*.94));
  const h=st.h?Math.min(+st.h,innerHeight*.82):null;
  let x=+st.x,y=+st.y;
  if(st.x===null||st.y===null||!isFinite(x)||!isFinite(y)){x=innerWidth-w-22;y=Math.max(20,innerHeight-(h||430)-22);}
  x=Math.max(8,Math.min(x,Math.max(8,innerWidth-w-8)));y=Math.max(8,Math.min(y,innerHeight-70));
  p.style.left=x+'px';p.style.top=y+'px';p.style.right='auto';p.style.bottom='auto';
  p.style.width=w+'px';p.style.height=h?h+'px':'';
  p.classList.toggle('mini',!!st.mini);}
function markInspecting(){$$('.gcell.inspecting').forEach(c=>c.classList.remove('inspecting'));
  const st=RT.inspector;if(!st)return;
  const td=document.querySelector(`[data-cell="${CSS.escape(st.id)}|${st.di}"]`);if(td)td.classList.add('inspecting');}
function closeInspector(){RT.inspector=null;$('#inspector').classList.remove('open');$$('.gcell.inspecting').forEach(c=>c.classList.remove('inspecting'));}
function openInspector(id,di,focus){const sh=gridSheet();if(!sh)return;
  const wasOpen=$('#inspector').classList.contains('open');
  const per=periodOf(sh.site);di=Math.max(0,Math.min(per.len-1,+di||0));
  RT.inspector={id:String(id),di,sheetKey:sh.key,site:sh.site};
  inspPref().mini=false;placeInspector();$('#inspector').classList.add('open');
  renderInspector();
  if(focus==='note')setTimeout(()=>$('#inspNote')?.focus(),80);
  if(!wasOpen)toast('Cell Inspector opened — drag its header to move it.','ok');}
function inspContext(){const st=RT.inspector;if(!st)return null;
  const sh=S.sheets.find(s=>s.key===st.sheetKey)||gridSheet();if(!sh)return null;
  const row=sh.rows.find(r=>String(r.id)===String(st.id));if(!row)return null;
  const per=periodOf(sh.site),ru=rulesOf(sh.site),hl=hlMap(sh.site),key=st.id+'|'+st.di;
  const r=R.find(x=>x.sheetKey===sh.key&&x.id===st.id);
  const dd=r&&r.days[st.di]?r.days[st.di]:{type:'blank',h:null,otH:0,otD:0};
  return{st,sh,row,per,ru,hl,key,r,dd,dt:per.dates[st.di],h:hl[key]||{}};}
function renderInspector(){const c=inspContext();if(!c){closeInspector();return;}
  const{st,sh,row,per,ru,hl,key,r,dd,dt,h}=c;
  const cls=INS_CLASS[dd.type]||INS_CLASS.blank;
  const rates=r?r.rates:{otHr:0,otDayRate:0,absRate:0,penRate:0,nh:ru.nh};
  const otMoney=(dd.otH*rates.otHr)+(dd.otD*rates.otDayRate);
  const absMoney=dd.type==='abs'?rates.absRate+rates.penRate:0;
  const normalH=Math.max(0,(+dd.h||0)-dd.otH);
  const raw=String(row.d[st.di]??'');
  $('#inspTitle').textContent=`${row.name||row.id} · Day ${st.di+1}`;
  $('#inspSub').textContent=`${WD[dt.getDay()]} ${dt.getDate()} ${MON[dt.getMonth()]} ${dt.getFullYear()} · ${sh.site} · drag to move`;
  const quick=[[String(ru.nh),'Normal '+ru.nh+'h'],[String(ru.nh+2),'OT '+(ru.nh+2)+'h'],['A','Absent A'],['OFF','Off OFF'],['__blank__','Blank']];
  $('#inspBody').innerHTML=`
    <div class="insp-section">Cell ${st.di+1} of ${per.len} · recorded value</div>
    <div style="display:flex;gap:7px;align-items:center;flex-wrap:wrap">
      <span class="badge" style="background:var(--bg2);border:1px solid var(--line);color:${cls[1]}">${icon('clock','width:11px;height:11px')}${cls[0]}</span>
      ${h.c?`<span class="badge b-ok">${icon('check')}${HL_COLORS[h.c].n}</span>`:''}
      ${r&&r.sev>0?statusBadge(r):''}
    </div>
    <div class="fld" style="display:flex;flex-direction:column;gap:4px"><label for="inspValue">Edit value (hours / day fraction / A / OFF / P / blank)</label>
      <input id="inspValue" type="text" value="${esc(raw)}" placeholder="e.g. 8, 1, A, OFF, P"></div>
    <div class="insp-quick">${quick.map(([v,l])=>`<button class="btn btn-sm" data-action="inspQuick" data-v="${esc(v)}" title="Set value">${l}</button>`).join('')}</div>
    <div class="insp-section">Calculated impact</div>
    <div class="insp-grid">
      <div class="insp-stat"><span>Normal hours</span><b>${fnum(normalH,1)} h</b></div>
      <div class="insp-stat"><span>OT hours / off-day</span><b>${fnum(dd.otH,1)} h · ${fnum(dd.otD,1)} d</b></div>
      <div class="insp-stat"><span>OT pay for cell</span><b style="color:var(--green)">+${fnum(otMoney)}</b></div>
      <div class="insp-stat"><span>Absence deduction</span><b style="color:var(--danger)">−${fnum(absMoney)}</b></div>
      <div class="insp-stat"><span>Row net pay</span><b>${r?fnum(r.net):'—'}</b></div>
      <div class="insp-stat"><span>Row status</span><b style="color:${r&&r.sev>0?'var(--warn)':'var(--green)'}">${r?r.status:'—'}</b></div>
    </div>
    <div class="insp-section">Highlight this cell</div>
    <div class="insp-swatches">${Object.entries(HL_COLORS).map(([k,o])=>`<button class="insp-sw ${h.c===k?'on':''}" data-action="inspHl" data-c="${k}"><i style="background:${o.css}"></i>${o.n}</button>`).join('')}
      <button class="insp-sw" data-action="inspHl" data-c="clear"><i style="background:transparent;border:1px dashed var(--tx3)"></i>Clear</button></div>
    <div class="insp-section">Cell note (included in Day Detail.xlsx)</div>
    <textarea id="inspNote" rows="2" style="width:100%;resize:vertical" placeholder="e.g. Missing punch-out — ask supervisor">${esc(h.n||'')}</textarea>`;
  $('#inspFoot').innerHTML=`
    <button class="btn btn-sm btn-p" data-action="inspSave" title="Save value and recalculate payroll">${icon('check')}Save cell</button>
    <button class="btn btn-sm" data-action="inspNoteSave">${icon('note')}Save note</button>
    <span class="spacer"></span>
    <button class="btn btn-sm" data-action="inspNav" data-d="-1" ${st.di===0?'disabled':''}>‹ Prev</button>
    <button class="btn btn-sm" data-action="inspNav" data-d="1" ${st.di===per.len-1?'disabled':''}>Next ›</button>
    <button class="btn btn-sm btn-g" data-action="inspRow" data-v="g">${icon('check')}Verify row</button>
    <button class="btn btn-sm btn-d" data-action="inspRow" data-v="r">${icon('flag')}Flag row</button>`;
  markInspecting();}
function inspSaveValue(){const c=inspContext();if(!c)return;const el=$('#inspValue');if(!el)return;
  let v=el.value.trim();if(v!==''&&/^-?\d+(\.\d+)?$/.test(v))v=Number(v);
  c.row.d[c.st.di]=v;act(`Cell edited · ${c.row.name||c.row.id} day ${c.st.di+1} (${c.sh.site})`,'pen');
  recompute();renderInspector();toast('Cell saved — payroll recalculated.','ok');}
function inspQuickSet(v){const c=inspContext();if(!c)return;
  c.row.d[c.st.di]=v==='__blank__'?'':v;
  recompute();renderInspector();toast(`Cell set to ${v==='__blank__'?'blank':v}.`,'ok');}
function inspSetHighlight(col){const c=inspContext();if(!c)return;
  if(col==='clear')delete c.hl[c.key];else c.hl[c.key]=Object.assign({},c.hl[c.key],{c:col});
  save();recompute();renderInspector();
  toast(col==='clear'?'Highlight cleared.':`Marked ${HL_COLORS[col].n}.`,col==='r'?'warn':'ok');}
function inspSaveNote(){const c=inspContext();if(!c)return;const el=$('#inspNote');if(!el)return;
  const n=el.value.trim();
  if(n)c.hl[c.key]=Object.assign({},c.hl[c.key],{n,c:c.hl[c.key]&&c.hl[c.key].c||'y'});
  else if(c.hl[c.key]){delete c.hl[c.key].n;if(!c.hl[c.key].c)delete c.hl[c.key];}
  save();recompute();renderInspector();toast(n?'Note saved.':'Note removed.','ok');}
function inspNav(d){const c=inspContext();if(!c)return;const n=c.st.di+ +d;if(n<0||n>=c.per.len)return;
  c.st.di=n;renderInspector();
  const td=document.querySelector(`[data-cell="${CSS.escape(c.st.id)}|${n}"]`);td?.scrollIntoView({block:'nearest',inline:'nearest',behavior:'smooth'});}
function inspRowMark(v){const c=inspContext();if(!c)return;RT.gSel=new Set([c.st.id]);bulkApply(v);RT.gSel=new Set();renderInspector();}
function toggleInspectorMini(){const st=inspPref();st.mini=!st.mini;placeInspector();save();}
function dockInspector(){Object.assign(inspPref(),{x:null,y:null,w:340,h:null,mini:false});placeInspector();save();toast('Inspector docked to the bottom-right.','ok');}
function initInspectorDrag(){const head=$('#inspHead'),p=$('#inspector');let d=null;
  head.addEventListener('pointerdown',e=>{if(e.target.closest('button'))return;
    const rc=p.getBoundingClientRect();d={dx:e.clientX-rc.left,dy:e.clientY-rc.top,w:rc.width};
    try{head.setPointerCapture(e.pointerId);}catch(err){}});
  head.addEventListener('pointermove',e=>{if(!d)return;const st=inspPref();
    const x=Math.max(8,Math.min(e.clientX-d.dx,innerWidth-d.w-8));
    const y=Math.max(8,Math.min(e.clientY-d.dy,innerHeight-58));
    p.style.left=x+'px';p.style.top=y+'px';p.style.right='auto';p.style.bottom='auto';st.x=x;st.y=y;});
  const end=()=>{if(!d)return;d=null;const rc=p.getBoundingClientRect();inspPref().w=Math.round(rc.width);inspPref().h=Math.round(rc.height);save();};
  head.addEventListener('pointerup',end);head.addEventListener('pointercancel',end);
  p.addEventListener('pointerup',()=>{const rc=p.getBoundingClientRect();inspPref().w=Math.round(rc.width);inspPref().h=Math.round(rc.height);save();});
  window.addEventListener('resize',debounce(()=>{if(RT.inspector){inspPref().x=null;inspPref().y=null;placeInspector();}},220));}

/* ---- dashboard panel order (drag handles) ---- */
function dashCards(){return $$('#view-dashboard .grid12 > .card[data-pid]');}
function applyDashOrder(){const grid=document.querySelector('#view-dashboard .grid12');if(!grid)return;
  const cards=dashCards(),by={};cards.forEach(c=>by[c.dataset.pid]=c);
  const order=(S.ui.dashOrder&&S.ui.dashOrder.length?S.ui.dashOrder:DEFAULT_DASH_ORDER).slice();
  order.forEach(id=>{if(by[id])grid.appendChild(by[id]);});
  cards.forEach(c=>{if(!order.includes(c.dataset.pid))grid.appendChild(c);});}
function clearDragClasses(){$$('.drop-target,.drag-src').forEach(c=>c.classList.remove('drop-target','drag-src'));}
function initDashPanels(){const grid=document.querySelector('#view-dashboard .grid12');if(!grid)return;
  dashCards().forEach(c=>{if(!c.querySelector('.drag-handle')){
    const h=document.createElement('div');h.className='drag-handle';h.draggable=false;h.dataset.pid=c.dataset.pid;
    h.innerHTML='<span style="font-size:13px">⠿</span> Drag panel';c.appendChild(h);}});
  grid.addEventListener('dragstart',e=>{const h=e.target.closest('.drag-handle');if(!h||!RT.arrange)return;
    RT.dragPid=h.dataset.pid;e.dataTransfer.effectAllowed='move';try{e.dataTransfer.setData('text/plain',RT.dragPid);}catch(err){}
    grid.querySelector(`.card[data-pid="${RT.dragPid}"]`)?.classList.add('drag-src');});
  grid.addEventListener('dragover',e=>{if(!RT.arrange||!RT.dragPid)return;const c=e.target.closest('.card[data-pid]');if(!c)return;
    e.preventDefault();e.dataTransfer.dropEffect='move';$$('.drop-target').forEach(x=>x.classList.remove('drop-target'));c.classList.add('drop-target');});
  grid.addEventListener('drop',e=>{const c=e.target.closest('.card[data-pid]');if(!c||!RT.arrange||!RT.dragPid)return;e.preventDefault();
    const src=RT.dragPid,tgt=c.dataset.pid;let order=dashCards().map(x=>x.dataset.pid);
    if(src!==tgt){order=order.filter(x=>x!==src);order.splice(Math.max(0,order.indexOf(tgt)),0,src);
      S.ui.dashOrder=order;applyDashOrder();save();act('Dashboard panel order changed','grid');toast('Panel order saved locally.','ok');}
    clearDragClasses();RT.dragPid=null;requestAnimationFrame(renderCharts);});
  grid.addEventListener('dragend',()=>{clearDragClasses();RT.dragPid=null;});
  applyDashOrder();}
function toggleArrange(){RT.arrange=!RT.arrange;
  $('#view-dashboard').classList.toggle('arranging',RT.arrange);
  const b=$('#arrangeBtn');b.classList.toggle('btn-p',RT.arrange);
  b.innerHTML=icon(RT.arrange?'check':'grid')+(RT.arrange?'Done arranging':'Arrange panels');
  $('#arrangeHint').textContent=RT.arrange?'Drag the ⠿ handle of any panel onto another panel to reorder it — the layout is saved locally.':'Tip: click a day cell in the Day Grid to inspect and edit it · panel positions are saved locally';
  $$('.drag-handle').forEach(h=>h.draggable=RT.arrange);
  toast(RT.arrange?'Arrange mode on — drag panels by their ⠿ handles.':'Layout saved.',RT.arrange?'warn':'ok');}
function resetDashOrder(){S.ui.dashOrder=DEFAULT_DASH_ORDER.slice();applyDashOrder();save();requestAnimationFrame(renderCharts);
  act('Dashboard layout reset','undo');toast('Default panel layout restored.','ok');}

/* ================= TEMPLATES & EXPORTS ================= */
const TPL_KEYS=COLS.filter(c=>!['flag','status','hl'].includes(c.k)).map(c=>c.k);
function tplDraft(){if(!RT.tplDraft){const t=S.templates.find(x=>x.id===RT.tplId)||S.templates[0];
  RT.tplDraft=t?JSON.parse(JSON.stringify(t)):{id:null,name:'',title:S.settings.company+' — Payroll',cols:['id','name','site','basic','otPay','absDed','net'],totals:true,sig:true,status:false};
  RT.tplId=RT.tplDraft.id;}return RT.tplDraft;}
function renderTpl(){
  const d=tplDraft();
  $('#tplList').innerHTML=S.templates.map(t=>`<button class="tplitem ${t.id===RT.tplId?'on':''}" data-action="tplLoad" data-id="${t.id}">${icon('tpl','width:14px;height:14px')}<span style="flex:1">${esc(t.name)}</span>${t.id===RT.tplId?icon('chev-r','width:12px;height:12px'):''}</button>`).join('')||'<span class="muted" style="font-size:12px;padding:6px">No saved templates yet.</span>';
  $('#tplEditorTitle').textContent=RT.tplId?'Edit template':'New template';
  if(document.activeElement!==$('#tplName'))$('#tplName').value=d.name;
  if(document.activeElement!==$('#tplTitle'))$('#tplTitle').value=d.title;
  $('#tplTotals').checked=d.totals;$('#tplSig').checked=d.sig;$('#tplStatus').checked=d.status;
  const ordered=d.cols.concat(TPL_KEYS.filter(k=>!d.cols.includes(k)));
  $('#tplCols').innerHTML=ordered.map(k=>{const on=d.cols.includes(k);const c=COLS.find(x=>x.k===k);const idx=d.cols.indexOf(k);
    return `<div class="tplcol-row ${on?'':'off'}"><input type="checkbox" data-bind="tplColToggle" data-k="${k}" ${on?'checked':''} aria-label="Include ${c.label}">
    <span class="grip">⠿</span><span style="flex:1">${c.label}</span>
    <button data-action="tplColUp" data-k="${k}" ${!on||idx===0?'disabled':''} title="Move up">${icon('up')}</button>
    <button data-action="tplColDown" data-k="${k}" ${!on||idx===d.cols.length-1?'disabled':''} title="Move down">${icon('down')}</button></div>`;}).join('');
  renderTplPreview();}
function renderTplPreview(){const d=tplDraft();const rows=filteredResults().slice(0,6);
  const cols=d.cols.map(k=>COLS.find(c=>c.k===k)).filter(Boolean);
  const extra=d.status?['Status','Highlights']:[];
  let html=`<div class="pv-title">${esc(d.title||d.name||'Payroll')}</div><div class="pv-sub">${esc(S.settings.company)} · ${monthLabel()} · generated ${new Date().toLocaleDateString('en-GB')}</div>
  <table class="pv-tbl"><thead><tr>${cols.map(c=>`<th>${c.label}</th>`).join('')}${extra.map(e=>`<th>${e}</th>`).join('')}</tr></thead><tbody>`;
  html+=rows.map(r=>`<tr>${d.cols.map(k=>`<td>${colDisplay(r,k)}</td>`).join('')}${d.status?`<td>${r.status}</td><td>${esc(hlStr(r))}</td>`:''}</tr>`).join('');
  if(d.totals)html+=`<tr class="tot"><td>TOTAL</td>${d.cols.slice(1).map(k=>{const c=COLS.find(x=>x.k===k);return `<td>${c&&c.num&&k!=='worked'?fnum(rows.reduce((s,r)=>s+(typeof colRaw(r,k)==='number'?colRaw(r,k):0),0)):'—'}</td>`;}).join('')}${extra.map(()=>'<td>—</td>').join('')}</tr>`;
  html+='</tbody></table>';
  if(d.sig)html+=`<div class="pv-sig"><span>Prepared by</span><span>Reviewed by</span><span>Approved by</span></div>`;
  if(!rows.length)html+='<p class="muted" style="text-align:center;margin-top:10px;font-size:12px">No result rows yet — load data to see a live preview.</p>';
  $('#tplPreview').innerHTML=html;}
function buildTemplateAoa(t,rows){
  const cols=t.cols.map(k=>COLS.find(c=>c.k===k)).filter(Boolean);
  const headers=cols.map(c=>c.label).concat(t.status?['Status','Grid Highlights']:[]);
  const aoa=[[t.title||t.name||'Payroll'],[`${S.settings.company} · ${monthLabel()} · generated ${new Date().toLocaleDateString('en-GB')}`],[],headers];
  rows.forEach(r=>{const line=t.cols.map(k=>colRaw(r,k));if(t.status)line.push(r.status,hlStr(r));aoa.push(line);});
  if(t.totals){const line=cols.map((c,i)=>{if(i===0)return 'TOTAL';if(!c.num||c.k==='worked')return '';const v=rows.reduce((s,r)=>{const x=colRaw(r,c.k);return s+(typeof x==='number'?x:0);},0);return Math.round(v*100)/100;});
    if(t.status)line.push('','');aoa.push(line);}
  if(t.sig){aoa.push([],[],['Prepared by: __________________','','Reviewed by: __________________','','Approved by: __________________']);}
  return aoa;}
function exportSummary(){if(!R.length){toast('Nothing to export yet — load data first.','warn');return;}
  const headers=['Status','Red Flags','Employee ID','Name','Site','Position','Basic (SAR)','Worked','OT Hours','OT Off-Days','OT Pay (SAR)','Absent Days','Absence Deduction (SAR)','Penalty (SAR)','Advance Deduction (SAR)','Total Deductions (SAR)','Net Pay (SAR)','Grid Highlights'];
  const aoa=[[`${S.settings.company} — Payroll Summary — ${monthLabel()}`],headers];
  R.slice().sort((a,b)=>a.site.localeCompare(b.site)||a.name.localeCompare(b.name)).forEach(r=>{
    aoa.push([r.status,r.flags.map(f=>f.short).join('; ')||'—',r.id,r.name,r.site,r.position,colRaw(r,'basic'),workedStr(r),colRaw(r,'otH'),colRaw(r,'otD'),colRaw(r,'otPay'),r.abs,colRaw(r,'absDed'),colRaw(r,'pen'),colRaw(r,'advD'),colRaw(r,'totDed'),colRaw(r,'net'),hlStr(r)]);});
  aoa.push(['TOTAL','','','','','',Math.round(AGG.bySite.reduce((s,x)=>s+R.filter(r=>r.site===x.site).reduce((y,r)=>y+r.basic,0),0)*100)/100,'',Math.round(AGG.otHours*10)/10,'',Math.round(AGG.ot*100)/100,AGG.abs,'','','',Math.round(AGG.ded*100)/100,Math.round(AGG.net*100)/100,'']);
  exportAoa(aoa,'Summary_'+S.settings.month,[12,22,13,22,18,14,12,14,10,11,12,11,16,12,17,17,13,24]);
  act(`Summary exported · ${R.length} rows`,'export');toast(`Summary exported — ${R.length} rows.`,'ok');}
function exportDetail(){const withSheets=R.filter(r=>r.hasSheet);
  if(!withSheets.length){toast('No timesheet day data to export yet.','warn');return;}
  const aoa=[[`${S.settings.company} — Day Detail — ${monthLabel()}`],['Employee ID','Name','Site','Date','Day #','Weekday','Recorded Value','Classification','Normal Hours','OT Hours','OT Off-Day','Highlight','Note']];
  const typeName={normal:'Normal',ot:'Overtime',offwork:'Off-day work (OT)',off:'Off day',abs:'Absent',blank:'—',bad:'Unreadable'};
  withSheets.forEach(r=>{const hl=hlMap(r.site);
    r.days.forEach(dd=>{const h=hl[r.id+'|'+dd.i];
      const normal=dd.type==='normal'||dd.type==='ot'?Math.max(0,(dd.h||0)-dd.otH):0;
      aoa.push([r.id,r.name,r.site,dd.dt.toISOString().slice(0,10),dd.i+1,WD[dd.dt.getDay()],dd.raw===''?'':dd.raw,typeName[dd.type]||dd.type,Math.round(normal*100)/100,Math.round(dd.otH*100)/100,dd.otD,h?HL_COLORS[h.c].n:'',h&&h.n?h.n:'']);});});
  exportAoa(aoa,'Day_Detail_'+S.settings.month,[13,22,18,12,7,9,14,18,12,10,11,11,32]);
  act(`Day Detail exported · ${aoa.length-2} day rows`,'export');toast(`Day Detail exported — ${aoa.length-2} rows.`,'ok');}
function exportTemplateById(id){const t=S.templates.find(x=>x.id===id)||RT.tplDraft;if(!t){toast('Create a template first.','warn');return;}
  const rows=filteredResults();if(!rows.length){toast('No rows to export with current filters.','warn');return;}
  exportAoa(buildTemplateAoa(t,rows),(t.name||'Template').replace(/[^\w\- ]+/g,'').trim().replace(/ /g,'_')+'_'+S.settings.month,[16,22,18,12,12,12,12,12,12,12,12,12,12,14]);
  act(`Template "${t.name}" exported · ${rows.length} rows`,'tpl');toast(`Exported "${t.name}" — ${rows.length} rows.`,'ok');}
function renderExportSel(){const el=$('#expTpl');if(!el)return;
  el.innerHTML=S.templates.map(t=>`<option value="${t.id}">${esc(t.name)}</option>`).join('')||'<option value="">No templates — create one first</option>';}
function doPrint(){const rows=filteredResults();if(!rows.length){toast('Nothing to print with current filters.','warn');return;}
  const cols=visibleCols().filter(c=>c.k!=='hl');
  const filt=`${RT.site==='all'?'All sites':RT.site}${RT.q?` · search "${RT.q}"`:''}${RT.flagged?' · flagged only':''}`;
  const sums=k=>rows.reduce((s,r)=>s+(+r[k]||0),0);
  $('#printRoot').innerHTML=`<h1>${esc(S.settings.company)} — Payroll Register</h1>
  <div class="psub">${monthLabel()} · ${esc(filt)} · ${rows.length} employees · generated ${new Date().toLocaleString('en-GB')} · Currency: SAR</div>
  <div class="pkpis"><div><b>${nf0.format(AGG.empCount)}</b>Employees</div><div><b>${AGG.siteCount}</b>Sites</div><div><b>${money(AGG.net)}</b>Total net pay</div><div><b>${money(AGG.ot)}</b>Total OT</div><div><b>${money(AGG.ded)}</b>Total deductions</div><div><b>${AGG.abs}</b>Absences</div><div><b>${AGG.flagged.length}</b>Flagged</div></div>
  <table><thead><tr>${cols.map(c=>`<th>${c.label}</th>`).join('')}</tr></thead><tbody>
  ${rows.map(r=>`<tr class="${r.sev>=2?'pr-dup':r.sev===1?'pr-ver':''}">${cols.map(c=>`<td>${c.k==='flag'?esc(colRaw(r,'flag')):c.k==='status'?r.status:colDisplay(r,c.k)}</td>`).join('')}</tr>`).join('')}
  <tr class="ptot"><td colspan="${Math.min(2,cols.length)}">TOTAL (${rows.length})</td>${cols.slice(2).map(c=>`<td>${['basic','otPay','absDed','pen','advD','totDed','net','otH','abs'].includes(c.k)?fnum(sums(c.k)):''}</td>`).join('')}</tr>
  </tbody></table>
  <div class="psig"><span>Prepared by</span><span>Checked by</span><span>Approved by</span></div>`;
  act('Payroll register printed','print');
  setTimeout(()=>window.print(),60);}
/* ================= SETTINGS, EVENTS, INIT ================= */
function renderSettings(){if(document.activeElement!==$('#companyName'))$('#companyName').value=S.settings.company;updateStorageMeter();renderTopbarBits();}
function applyTheme(){document.documentElement.dataset.theme=S.settings.theme;renderTopbarBits();if(RT.tab==='dashboard')requestAnimationFrame(renderCharts);}
function setTheme(t){S.settings.theme=t;applyTheme();save();}
const README_MD=['# Payroll Pro — Saudi Staffing Payroll Calculator (SAR)','',
'A single-file, offline-first payroll calculator for staffing companies in Saudi Arabia.','25 client timesheets in, one verified payroll out — no server, no install.','',
'## Run locally (double-click)','1. Download index.html.','2. Double-click it — it opens in your browser via file:// and fully works.','3. Your master, timesheets, mappings, highlights and templates are saved in localStorage on that device.','',
'## Deploy to GitHub Pages','1. Create a repository and add index.html (and this README.md) to the root.','2. Repo → Settings → Pages → Build and deployment → Deploy from a branch.','3. Pick branch main, folder / (root), Save.','4. Open https://YOUR-USERNAME.github.io/YOUR-REPO/','',
'## Offline behaviour','- SheetJS and Chart.js load from CDN and are cached by the browser after the first online visit.','- If unavailable, the app falls back to built-in canvas charts and CSV export (Excel opens CSV directly). Reading .xlsx requires SheetJS — open the app online once, or use .csv files.','',
'## Monthly workflow','1. Download Employee Template.xlsx → fill the 15 columns → Load Employee Master.','2. Load Timesheets → select all 25 site files. First time per site: map ID / Name / Day columns and set rules (normal hours, OT rate/hr, OT rate/off-day, count type, absence rule, penalty, period start 1/21/25/26, days in month). Mappings are remembered per site.','3. Fix issues in the Upload check dialog (duplicate IDs, unknown employees, >24h cells) or continue with flags.','4. Dashboard: KPI cards with mini-charts, pay-by-site bar, OT vs deductions doughnut, expandable flagged-employees panel.','5. Day Grid: paint red/yellow/green/blue/black, add notes, bulk verify/flag rows, filter flagged/unverified. Highlights persist per site + month and are included in exports.','6. Payroll Results: site filter, search, sort any column, column toggles, Only-flagged. Flagged rows are always tinted with a Red Flag column.','7. Export: Summary.xlsx, Day Detail.xlsx, custom named templates, clean Print/PDF.','',
'## Cell inspector & draggable panels','- Day Grid defaults to the Inspect tool: click any day cell to open the floating Cell Inspector. Right-click or Alt-click works from any brush; double-click also opens it.','- In the inspector: edit the recorded value, use quick-set buttons (normal / OT / absent / off / blank), see the calculated pay impact for that cell, choose a highlight colour, write a note, verify or flag the whole row, and step through days with Prev/Next or the arrow keys. Ctrl+Enter saves the value.','- The inspector is a real floating panel: drag its header to move it, resize it from the bottom-right corner, minimise it, or dock it back to the bottom-right. Position and size are saved in localStorage.','- Dashboard: click Arrange panels, then drag the ⠿ handle of any panel onto another to reorder the chart/overview cards. Reset layout restores the default order. The order is saved locally.','',
'## Formulas','- Net Pay = Basic + OT Pay − Absence Deduction − Penalty − Advance Deduction','- OT Pay = OT Hours × OT Rate/hr + OT Off-Days × OT Rate/day','- Absence Deduction = Absent Days × (Basic ÷ Days in Month) — or fixed/day, or none','- Advance Deduction = Advance Amount ÷ Advance Months','- OT rate priority: site rate → employee OT Fixed Rate → base hourly × OT Multiplier','',
'## Day-cell codes','Numbers = hours (or day fractions when count type = Days) · A / ABS / غياب = absent · OFF / R / راحة = off day · P = present (normal hours) · blank = no entry · 8:30 = 8.5 h','',
'## Flags','Duplicate — ID repeated in master or across timesheets · Suspicious — totals exceed days × 24h or a day > 24h · Verify — 0 OT and 0 absences, missing master, no timesheet row, unreadable cells, red grid marks, negative net.','',
'## Privacy','All data stays in your browser (localStorage). Nothing is uploaded anywhere. Use Data & Settings → Backup to move between machines.',''].join('\n');

/* ---------- delegated actions ---------- */
const ACTIONS={
  nav:b=>switchTab(b.dataset.tab),
  menu:()=>{$('#sidebar').classList.toggle('open');$('#scrim').classList.toggle('show',$('#sidebar').classList.contains('open'));},
  theme:()=>setTheme(S.settings.theme==='dark'?'light':'dark'),
  themeSet:b=>setTheme(b.dataset.t),
  loadMaster:()=>$('#fileMaster').click(),
  loadSheets:()=>$('#fileSheets').click(),
  dlTemplate:()=>downloadMasterTemplate(),
  kpiFlags:()=>{RT.flagged=true;RT.site='all';RT.q='';RT.page=1;switchTab('results');},
  flagsReview:()=>ACTIONS.kpiFlags(),
  flagsToggle:()=>{S.ui.flagsOpen=!S.ui.flagsOpen;save();renderFlagPanel();},
  openEmp:b=>openEmpDrawer(b.dataset.key),
  openGridFor:b=>openGridFor(b.dataset.key),
  siteOpen:b=>{RT.site=b.dataset.site;RT.flagged=false;RT.q='';RT.page=1;switchTab('results');},
  sort:b=>{const k=b.dataset.k;if(RT.sortKey===k)RT.sortDir=RT.sortDir==='asc'?'desc':'asc';else{RT.sortKey=k;RT.sortDir=k==='name'||k==='id'||k==='site'?'asc':'desc';}renderResults();},
  page:b=>{RT.page=+b.dataset.p;renderResults();$('#resWrap').scrollTop=0;},
  colMenu:()=>{$('#colMenu').classList.toggle('open');$('#expMenuRes').classList.remove('open');},
  expMenu:()=>{$('#expMenuRes').classList.toggle('open');$('#colMenu').classList.remove('open');},
  flaggedOnly:()=>{RT.flagged=!RT.flagged;RT.page=1;renderResults();},
  exportSummary:()=>exportSummary(),exportDetail:()=>exportDetail(),print:()=>doPrint(),
  addEmp:()=>editEmpDrawer(null),
  editEmp:b=>editEmpDrawer(b.dataset.id),
  saveEmp:b=>saveEmpFromDrawer(b.dataset.orig),
  delEmp:b=>{const id=b.dataset.id;const e=findMaster(id);if(!e)return;
    confirmDlg('Delete employee?',`<b>${esc(e.name)}</b> (${esc(id)}) will be removed from the master. Timesheet rows for this ID become "No master" flags.`,'Delete',()=>{
      const i=S.master.indexOf(e);S.master.splice(i,1);recompute();
      toast(`${e.name} deleted.`,'warn',{label:'Undo',fn:()=>{S.master.splice(i,0,e);recompute();toast('Restored.','ok');}});});},
  qeSave:b=>{const e=findMaster(b.dataset.id);if(!e)return;
    e.basic=+$('#qeBasic').value||0;e.adv=+$('#qeAdv').value||0;e.advM=Math.max(1,+$('#qeAdvM').value||1);e.pen=+$('#qePen').value||0;
    act('Quick-edited '+e.name,'pen');recompute();toast('Saved — payroll recalculated.','ok');
    const r=R.find(x=>x.id===String(e.id).trim());if(r)openEmpDrawer(r.key);},
  adoptEmp:b=>{const r=findResult(b.dataset.key);if(!r)return;
    S.master.push({id:r.id,name:r.name,site:r.site,position:'—',basic:0,payBy:'Day',rateDay:0,rateHour:0,otMult:1.5,otFixed:0,dim:0,offDay:'',adv:0,advM:1,pen:0});
    recompute();toast('Added to master — set the salary now.','ok');editEmpDrawer(r.id);},
  closeDrawer:()=>closeDrawer(),closeModal:()=>{closeModal();},
  mapSite:b=>{const sh=S.sheets.find(x=>x.key===b.dataset.key);if(sh){RT.mapCur=null;openMapper(sh,false);}},
  mapAuto:()=>{const mc=RT.mapCur;if(!mc)return;const sh=S.sheets.find(x=>x.key===mc.key);
    const det=autoDetect(sh.raw||[],mc.draft.headerRow);Object.assign(mc.draft,det);
    const keep=mc.draft;openMapper(sh,mc.fromQueue);RT.mapCur.draft=keep;renderRawPrev();
    ['idCol','nameCol','dayFrom','dayTo'].forEach(f=>{const el=document.querySelector(`[data-bind="map"][data-f="${f}"]`);if(el)el.value=keep[f];});
    toast('Columns auto-detected — verify the highlighted preview.','ok');},
  mapCancel:()=>{const mc=RT.mapCur;closeModal();RT.mapCur=null;
    if(mc&&mc.fromQueue){RT.mapQueue=RT.mapQueue.filter(k=>k!==mc.key);processMapQueue();}},
  mapSave:()=>saveMapping(),
  gridSite:b=>{RT.gSite=b.dataset.key;RT.gSel.clear();switchTab('grid');},
  removeSheet:b=>{const sh=S.sheets.find(x=>x.key===b.dataset.key);if(!sh)return;
    confirmDlg('Remove timesheet?',`<b>${esc(sh.fileName)}</b> (${esc(sh.site)}) will be removed from this payroll run. The saved site mapping is kept.`,'Remove',()=>{
      const i=S.sheets.indexOf(sh);S.sheets.splice(i,1);recompute();
      toast('Timesheet removed.','warn',{label:'Undo',fn:()=>{S.sheets.splice(i,0,sh);recompute();}});});},
  brush:b=>{RT.gBrush=b.dataset.c;renderBrushes();
    if(b.dataset.c==='inspect')toast('Inspect tool: click any day cell to open the draggable Cell Inspector.','ok');},
  arrangeToggle:()=>toggleArrange(),
  dashReset:()=>resetDashOrder(),
  inspClose:()=>closeInspector(),
  inspMini:()=>toggleInspectorMini(),
  inspDock:()=>dockInspector(),
  inspSave:()=>inspSaveValue(),
  inspQuick:b=>inspQuickSet(b.dataset.v),
  inspHl:b=>inspSetHighlight(b.dataset.c),
  inspNoteSave:()=>inspSaveNote(),
  inspNav:b=>inspNav(+b.dataset.d),
  inspRow:b=>inspRowMark(b.dataset.v),
  gridClearHl:()=>{const sh=gridSheet();if(!sh)return;const key=hlKey(sh.site);
    confirmDlg('Clear all highlights?',`Remove every colour & note for <b>${esc(sh.site)}</b> · ${monthLabel()}?`,'Clear',()=>{
      const old=S.highlights[key];delete S.highlights[key];recompute();renderGrid();
      toast('Highlights cleared.','warn',{label:'Undo',fn:()=>{S.highlights[key]=old;recompute();renderGrid();}});});},
  bulkVerify:()=>bulkApply('g'),bulkFlag:()=>bulkApply('r'),bulkClear:()=>bulkApply(null),
  noteColor:b=>{RT.noteColor=b.dataset.c;$$('#modalBox [data-action="noteColor"]').forEach(x=>x.classList.toggle('on',x.dataset.c===RT.noteColor));},
  noteSave:b=>{const sh=gridSheet();if(!sh)return;const hl=hlMap(sh.site);const key=b.dataset.id+'|'+b.dataset.di;
    const n=$('#noteText').value.trim();hl[key]={c:RT.noteColor||'y'};if(n)hl[key].n=n;
    save();closeModal();computeAll();renderNavBadges();renderGrid();toast(n?'Note saved.':'Highlight saved.','ok');},
  noteDelete:b=>{const sh=gridSheet();if(!sh)return;delete hlMap(sh.site)[b.dataset.id+'|'+b.dataset.di];
    save();closeModal();computeAll();renderNavBadges();renderGrid();},
  issueFix:b=>fixIssue(+b.dataset.i),
  issuesAutoFix:()=>{RT.issues.forEach((it,i)=>{if(!it.fixed)fixIssue(i,true);});
    const n=RT.issues.length;RT.issues=[];closeModal();recompute();act(`Upload check: ${n} issue(s) auto-fixed`,'check');toast(`${n} issue(s) fixed.`,'ok');},
  issuesClose:()=>{const open=RT.issues.filter(i=>!i.fixed).length;RT.issues=[];closeModal();recompute();
    if(open)toast(`${open} issue(s) left as-is — rows stay flagged in Results.`,'warn');},
  tplNew:()=>{RT.tplId=null;RT.tplDraft=null;tplDraft();renderTpl();},
  tplLoad:b=>{RT.tplId=b.dataset.id;RT.tplDraft=null;tplDraft();renderTpl();},
  tplSave:()=>{const d=tplDraft();if(!d.name.trim()){d.name='Template '+(S.templates.length+1);}
    if(!d.cols.length){toast('Pick at least one column.','err');return;}
    if(RT.tplId){const i=S.templates.findIndex(t=>t.id===RT.tplId);if(i>=0)S.templates[i]=JSON.parse(JSON.stringify(d));}
    else{d.id='tpl-'+uid();RT.tplId=d.id;S.templates.push(JSON.parse(JSON.stringify(d)));}
    save();act(`Template "${d.name}" saved`,'tpl');renderTpl();renderExportSel();toast(`Template "${d.name}" saved.`,'ok');},
  tplDelete:()=>{if(!RT.tplId){RT.tplDraft=null;renderTpl();return;}
    const t=S.templates.find(x=>x.id===RT.tplId);
    confirmDlg('Delete template?',`"<b>${esc(t?t.name:'')}</b>" will be removed.`,'Delete',()=>{
      S.templates=S.templates.filter(x=>x.id!==RT.tplId);RT.tplId=null;RT.tplDraft=null;save();renderTpl();renderExportSel();toast('Template deleted.','ok');});},
  tplColUp:b=>{const c=tplDraft().cols;const i=c.indexOf(b.dataset.k);if(i>0){[c[i-1],c[i]]=[c[i],c[i-1]];renderTpl();}},
  tplColDown:b=>{const c=tplDraft().cols;const i=c.indexOf(b.dataset.k);if(i>=0&&i<c.length-1){[c[i+1],c[i]]=[c[i],c[i+1]];renderTpl();}},
  tplExport:()=>exportTemplateById(RT.tplId||'__draft__'),
  exportTemplate:()=>exportTemplateById($('#expTpl').value),
  backup:()=>{downloadBlob(new Blob([JSON.stringify(S,null,1)],{type:'application/json'}),'PayrollPro_Backup_'+S.settings.month+'.json');act('Backup downloaded','download');toast('Backup downloaded.','ok');},
  restore:()=>$('#fileRestore').click(),
  clearAll:()=>confirmDlg('Erase everything?','Master, timesheets, mappings, highlights and templates will be deleted from this browser.','Erase all',()=>{
    const prev=S;localStorage.removeItem(LS_KEY);S=defaultState();S.seeded=true;RT.tplDraft=null;RT.tplId=null;save();recompute();switchTab('dashboard');
    toast('Workspace erased.','warn',{label:'Undo',fn:()=>{S=prev;save();recompute();switchTab('dashboard');}});}),
  demo:()=>confirmDlg('Load demo data?','Replaces the current workspace with the 25-site demo dataset.','Load demo',()=>{
    seedDemo();RT.tplDraft=null;RT.tplId=null;RT.gSite=null;recompute();switchTab('dashboard');toast('Demo data loaded — 25 sites.','ok');},false),
  readme:()=>{downloadBlob(new Blob([README_MD],{type:'text/markdown'}),'README.md');toast('README.md downloaded.','ok');}
};
document.addEventListener('click',e=>{
  const b=e.target.closest('[data-action]');
  if(!e.target.closest('.dropdown'))$$('.menu.open').forEach(m=>m.classList.remove('open'));
  if(!b||b.disabled)return;
  const fn=ACTIONS[b.dataset.action];
  if(fn){if(b.tagName==='A')e.preventDefault();fn(b,e);}
});
/* ---------- delegated inputs ---------- */
const searchDeb=debounce(()=>{RT.page=1;if(RT.tab!=='results')switchTab('results');else renderResults();},180);
const empDeb=debounce(()=>renderEmp(),180);
document.addEventListener('input',e=>{
  const el=e.target,b=el.dataset.bind;if(!b)return;
  switch(b){
    case 'topSearch':RT.q=el.value.trim();searchDeb();break;
    case 'fSearch':RT.q=el.value.trim();$('#topSearch').value=el.value;searchDeb();break;
    case 'empSearch':RT.empQ=el.value.trim();empDeb();break;
    case 'tplName':tplDraft().name=el.value;renderTplPreview();break;
    case 'tplTitle':tplDraft().title=el.value;renderTplPreview();break;
    case 'map':case 'maprule':{const mc=RT.mapCur;if(!mc)break;const f=el.dataset.f;
      const numeric=['headerRow','idCol','nameCol','dayFrom','dayTo','nh','otHr','otDay','pen','absFixed','dim','start'];
      const v=numeric.includes(f)?+el.value:el.value;
      if(b==='map')mc.draft[f]=v;else mc.draft.rules[f]=v;
      if(f==='headerRow'){updateMapperSelects();}
      if(b==='map')renderRawPrev();break;}
  }});
document.addEventListener('change',e=>{
  const el=e.target,b=el.dataset.bind;if(!b)return;
  switch(b){
    case 'month':S.settings.month=el.value||curMonth();RT.gSel.clear();act('Payroll month set to '+monthLabel(),'clock');recompute();break;
    case 'fSite':RT.site=el.value;RT.page=1;renderResults();break;
    case 'empSite':RT.empSite=el.value;renderEmp();break;
    case 'pageSize':S.ui.pageSize=+el.value;RT.page=1;save();renderResults();break;
    case 'barTop':S.ui.barTop=+el.value;save();renderCharts();break;
    case 'colToggle':{const k=el.dataset.col;const set=new Set(S.ui.resCols);el.checked?set.add(k):set.delete(k);S.ui.resCols=[...set];save();renderResults();$('#colMenu').classList.add('open');break;}
    case 'gSite':RT.gSite=el.value;RT.gSel.clear();renderGrid();break;
    case 'gFilter':RT.gFilter=el.value;renderGrid();break;
    case 'gSel':el.checked?RT.gSel.add(el.dataset.id):RT.gSel.delete(el.dataset.id);updateBulkBar();break;
    case 'gSelAll':$$('#gridWrap [data-bind="gSel"]').forEach(c=>{c.checked=el.checked;el.checked?RT.gSel.add(c.dataset.id):RT.gSel.delete(c.dataset.id);});updateBulkBar();break;
    case 'tplTotals':tplDraft().totals=el.checked;renderTplPreview();break;
    case 'tplSig':tplDraft().sig=el.checked;renderTplPreview();break;
    case 'tplStatus':tplDraft().status=el.checked;renderTplPreview();break;
    case 'tplColToggle':{const d=tplDraft();const k=el.dataset.k;if(el.checked){if(!d.cols.includes(k))d.cols.push(k);}else d.cols=d.cols.filter(x=>x!==k);renderTpl();break;}
    case 'company':S.settings.company=el.value.trim()||'Your Company';save();toast('Company name saved.','ok');break;
    case 'map':case 'maprule':{const mc=RT.mapCur;if(!mc)break;const f=el.dataset.f;
      const numeric=['headerRow','idCol','nameCol','dayFrom','dayTo','nh','otHr','otDay','pen','absFixed','dim','start'];
      const v=numeric.includes(f)?+el.value:el.value;
      if(b==='map')mc.draft[f]=v;else mc.draft.rules[f]=v;
      if(f==='headerRow')updateMapperSelects();
      if(b==='map')renderRawPrev();break;}
  }});
function updateMapperSelects(){const mc=RT.mapCur;if(!mc)return;const sh=S.sheets.find(x=>x.key===mc.key);if(!sh)return;
  const heads=(sh.raw||[])[mc.draft.headerRow]||[];
  ['idCol','nameCol','dayFrom','dayTo'].forEach(f=>{const el=document.querySelector(`[data-bind="map"][data-f="${f}"]`);if(!el)return;
    el.innerHTML=`<option value="-1">—</option>`+heads.map((h,i)=>`<option value="${i}" ${i===mc.draft[f]?'selected':''}>${String.fromCharCode(65+i%26)} — ${esc(String(h).slice(0,18)||'(blank)')}</option>`).join('');});}
/* file inputs */
$('#fileMaster').addEventListener('change',e=>{if(e.target.files[0])handleMasterFile(e.target.files[0]);e.target.value='';});
$('#fileSheets').addEventListener('change',e=>{if(e.target.files.length)handleSheetFiles([...e.target.files]);e.target.value='';});
$('#fileRestore').addEventListener('change',async e=>{const f=e.target.files[0];e.target.value='';if(!f)return;
  try{const p=JSON.parse(await f.text());if(!p.settings||!Array.isArray(p.master))throw 0;
    S=Object.assign(defaultState(),p);S.ui=Object.assign(defaultState().ui,p.ui||{});RT.tplDraft=null;RT.tplId=null;
    applyTheme();recompute();switchTab('dashboard');act('Backup restored','upload');toast('Backup restored.','ok');}
  catch(err){toast('Invalid backup file.','err');}});
/* dropzone */
const dz=$('#dz');
['dragover','dragenter'].forEach(ev=>dz.addEventListener(ev,e=>{e.preventDefault();dz.classList.add('drag');}));
['dragleave','drop'].forEach(ev=>dz.addEventListener(ev,e=>{e.preventDefault();dz.classList.remove('drag');}));
dz.addEventListener('drop',e=>{const files=[...(e.dataTransfer?.files||[])].filter(f=>/\.(xlsx|xls|csv)$/i.test(f.name));
  if(files.length)handleSheetFiles(files);else toast('Drop .xlsx / .csv timesheet files.','warn');});
/* grid painting */
const gw=$('#gridWrap');
const cellOf=e=>{const td=e.target.closest('td.gcell');if(!td)return null;const[id,di]=td.dataset.cell.split('|');return{id,di:+di};};
gw.addEventListener('mousedown',e=>{const c=cellOf(e);if(!c||e.button!==0)return;
  if(RT.gBrush==='inspect'||e.altKey||e.detail>=2){e.preventDefault();return;}
  e.preventDefault();
  if(RT.gBrush==='note'){paintCell(c.id,c.di);return;}
  RT.painting=true;paintCell(c.id,c.di);});
gw.addEventListener('mouseover',e=>{if(!RT.painting)return;const c=cellOf(e);if(!c)return;paintCell(c.id,c.di);});
window.addEventListener('mouseup',()=>{if(RT.painting){RT.painting=false;afterPaint();}});
gw.addEventListener('click',e=>{const c=cellOf(e);if(!c)return;if(RT.gBrush==='inspect'||e.altKey)openInspector(c.id,c.di);});
gw.addEventListener('dblclick',e=>{const c=cellOf(e);if(!c)return;e.preventDefault();if(RT.gBrush!=='inspect')openInspector(c.id,c.di);});
gw.addEventListener('contextmenu',e=>{const c=cellOf(e);if(!c)return;e.preventDefault();openInspector(c.id,c.di,'note');});
document.addEventListener('keydown',e=>{
  if(!RT.inspector||!$('#inspector').classList.contains('open'))return;
  const typing=/INPUT|TEXTAREA|SELECT/.test((document.activeElement&&document.activeElement.tagName)||'');
  if((e.ctrlKey||e.metaKey)&&e.key==='Enter'){e.preventDefault();inspSaveValue();return;}
  if(typing)return;
  if(e.key==='ArrowLeft'){e.preventDefault();inspNav(-1);}
  else if(e.key==='ArrowRight'){e.preventDefault();inspNav(1);}
  else if(e.key==='Escape'){closeInspector();}
});
/* keyboard */
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'){if($('#modalOv').classList.contains('open')){RT.mapCur&&RT.mapCur.fromQueue?ACTIONS.mapCancel():closeModal();}
    else if($('#drawer').classList.contains('open'))closeDrawer();
    else $$('.menu.open').forEach(m=>m.classList.remove('open'));}
  if(e.key==='Enter'&&e.target.id==='flagHead')ACTIONS.flagsToggle();});
window.addEventListener('resize',debounce(()=>{if(RT.tab==='dashboard'&&!window.Chart)renderCharts();},200));
/* ---------- init ---------- */
(function init(){
  const had=loadState();
  if(!had&&!S.master.length&&!S.sheets.length){seedDemo();
    setTimeout(()=>toast('Demo workspace loaded — 25 Saudi sites. Replace with your files anytime.','ok'),700);}
  if(!S.templates.length)seedTemplates();
  document.documentElement.dataset.theme=S.settings.theme;
  computeAll();renderAll();updateStorageMeter();initInspectorDrag();initDashPanels();requestAnimationFrame(renderCharts);
  const libs=[];if(!window.XLSX)libs.push('Excel→CSV fallback');if(!window.Chart)libs.push('built-in charts');
  if(libs.length){$('#libStatus').textContent='Offline mode · '+libs.join(' · ');
    setTimeout(()=>toast('CDN libraries unavailable — using '+libs.join(' and ')+'. Everything still works.','warn'),1400);}
})();
