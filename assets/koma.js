/* KOMA engine — deterministic comic generator.
   Course data (structured JSON) -> comic pages, skill checks, boss battles, mission, report.
   No AI at runtime: the same course file always renders the same comic. */
(function(){
'use strict';
const $=s=>document.querySelector(s);
const app=$('#app');
const ROOT=document.body.dataset.root||'./';
const COURSE=(()=>{const n=$('#course');return n?JSON.parse(n.textContent):null})();
const CATALOG=(()=>{const n=$('#catalog');return n?JSON.parse(n.textContent):null})();
const track=(name,p)=>{try{if(window.gtag)window.gtag('event',name,p||{})}catch(e){}};

/* ---------------- state ---------------- */
const load=(k,d)=>{try{return Object.assign(d,JSON.parse(localStorage.getItem(k)||'{}'))}catch(e){return d}};
const put=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}};
const G=load('koma.g',{style:'anime',xp:0,requests:[]});
const saveG=()=>put('koma.g',G);
const freshC=()=>({picked:[],done:{},scores:{},mission:null,seenOverview:false});
let S=COURSE?load('koma.c.'+COURSE.id,freshC()):null;
const saveS=()=>{if(COURSE)put('koma.c.'+COURSE.id,S)};

/* ---------------- deterministic helpers ---------------- */
function hash(str){let h=2166136261;for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0}
function rng(seed){let s=seed||1;return()=>{s^=s<<13;s>>>=0;s^=s>>17;s^=s<<5;s>>>=0;return s/4294967296}}
function pick(arr,seed){return arr[seed%arr.length]}
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const md=s=>esc(s).replace(/\*\*(.+?)\*\*/g,'<mark>$1</mark>');
/* Source question format: [question, [correct, wrong, wrong, wrong], explanation]
   Options are shuffled with a seed from the question text, so order is stable across visits. */
function Q(src,who){
  const [q,opts,e]=src;const r=rng(hash(q));const idx=opts.map((_,i)=>i);
  for(let i=idx.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[idx[i],idx[j]]=[idx[j],idx[i]]}
  return {q,o:idx.map(i=>opts[i]),a:idx.indexOf(0),e,who:who||'kai'};
}

/* ---------------- art ---------------- */
function eyes(x,mood,who,c){
  const iris=who==='kai'?'#1fb8aa':'#b04bff';
  if(c){
    const brow=mood==='determined'?`<path d="M${x-7} ${x<50?49:53} L${x+7} ${x<50?53:49}" stroke="#111" stroke-width="3.5" stroke-linecap="round"/>`
      :`<path d="M${x-7} 50 Q${x} ${mood==='shock'?43:46} ${x+7} 50" stroke="#111" stroke-width="3" fill="none" stroke-linecap="round"/>`;
    if(mood==='shock')return brow+`<circle cx="${x}" cy="60" r="6" fill="#fff" stroke="#111" stroke-width="2.5"/><circle cx="${x}" cy="60" r="2" fill="#111"/>`;
    if(mood==='wink'&&x>50)return brow+`<path d="M${x-6} 61 Q${x} 55 ${x+6} 61" stroke="#111" stroke-width="3" fill="none" stroke-linecap="round"/>`;
    if(mood==='happy')return brow+`<path d="M${x-6} 62 Q${x} 54 ${x+6} 62" stroke="#111" stroke-width="3.4" fill="none" stroke-linecap="round"/>`;
    return brow+`<ellipse cx="${x}" cy="${mood==='think'?58:60}" rx="3.4" ry="4.6" fill="#111"/>`;
  }
  if(mood==='happy'||(mood==='wink'&&x>50))return `<path d="M${x-7} 62 Q${x} 52 ${x+7} 62" stroke="#2b1b4a" stroke-width="3" fill="none" stroke-linecap="round"/>`;
  if(mood==='shock')return `<ellipse cx="${x}" cy="60" rx="6.5" ry="8.5" fill="#fff" stroke="#2b1b4a" stroke-width="1.6"/><circle cx="${x}" cy="60" r="2.4" fill="#2b1b4a"/>`;
  const dy=mood==='think'?-2:0;
  let e=`<ellipse cx="${x}" cy="${60+dy}" rx="6" ry="8.5" fill="#2b1b4a"/><ellipse cx="${x}" cy="${62+dy}" rx="4.4" ry="5.6" fill="${iris}"/><circle cx="${x-2.2}" cy="${56.5+dy}" r="2.4" fill="#fff"/><circle cx="${x+2}" cy="${64+dy}" r="1.1" fill="#fff"/>`;
  if(mood==='determined')e+=`<path d="M${x-8} ${x<50?48:51} L${x+8} ${x<50?51:48}" stroke="#2b1b4a" stroke-width="2.4" stroke-linecap="round"/>`;
  else e+=`<path d="M${x-7} 49 Q${x} 46 ${x+7} 49" stroke="#2b1b4a" stroke-width="1.8" fill="none" stroke-linecap="round"/>`;
  return e;
}
function mouth(mood,c){
  const st=c?'#111':'#7a2e48',w=c?3:2.2;
  switch(mood){
    case 'shock':return `<ellipse cx="50" cy="78" rx="4.5" ry="5.5" fill="#7a1f33" stroke="${st}" stroke-width="${c?2.5:1}"/>`;
    case 'think':return `<path d="M44 78 Q48 76 55 76" stroke="${st}" stroke-width="${w}" fill="none" stroke-linecap="round"/>`;
    case 'wink':case 'smile':return `<path d="M43 75 Q50 82 57 75" stroke="${st}" stroke-width="${w}" fill="none" stroke-linecap="round"/>`;
    case 'determined':return `<path d="M44 77 Q51 80 57 73" stroke="${st}" stroke-width="${w}" fill="none" stroke-linecap="round"/>`;
    default:return `<path d="M42 73 Q50 87 58 73Z" fill="#d6455f" stroke="${st}" stroke-width="${c?2.5:1.2}" stroke-linejoin="round"/>`;
  }
}
function robot(mood,c){
  const ol=c?'#111':'#ff5c8a',sw=c?3.5:2,body=c?'#b8c2cc':'#2a2045',scr=c?'#000':'#0d0a1c',glow=c?'#ffd400':'#ff4f7b';
  const e=mood==='hurt'?`<path d="M34 42 l10 10 M44 42 l-10 10 M56 42 l10 10 M66 42 l-10 10" stroke="${glow}" stroke-width="4" stroke-linecap="round"/>`
    :`<path d="M33 41 L46 46 L46 52 L33 50Z M67 41 L54 46 L54 52 L67 50Z" fill="${glow}"/>`;
  const m=mood==='laugh'?`<path d="M38 58 L62 58 L58 66 L42 66Z" fill="${glow}"/>`:`<path d="M38 61 l4 -3 l4 3 l4 -3 l4 3 l4 -3 l4 3" stroke="${glow}" stroke-width="2.5" fill="none"/>`;
  return `<svg viewBox="0 0 100 130" class="ch"><line x1="50" y1="6" x2="50" y2="20" stroke="${ol}" stroke-width="${sw}"/><circle cx="50" cy="6" r="5" fill="${glow}" stroke="${ol}" stroke-width="${c?2.5:0}"/>
  <path d="M22 130 L28 92 L72 92 L78 130Z" fill="${body}" stroke="${ol}" stroke-width="${sw}"/><circle cx="50" cy="110" r="8" fill="${glow}" stroke="${ol}" stroke-width="${c?2.5:0}"/>
  <rect x="16" y="20" width="68" height="62" rx="14" fill="${body}" stroke="${ol}" stroke-width="${sw}"/><rect x="10" y="40" width="7" height="20" rx="3" fill="${body}" stroke="${ol}" stroke-width="${sw}"/><rect x="83" y="40" width="7" height="20" rx="3" fill="${body}" stroke="${ol}" stroke-width="${sw}"/>
  <rect x="24" y="30" width="52" height="44" rx="8" fill="${scr}" stroke="${ol}" stroke-width="${c?2.5:1}"/>${e}${m}</svg>`;
}
function char(who,mood){
  mood=mood||'happy';
  const c=G.style==='comic';
  if(who==='algo')return robot(mood,c);
  const ol=c?'#111':'#6b4f86',sw=c?3:1.6,skin='#ffe1cb';
  const hair=who==='kai'?(c?'#1f4fd1':'#20bfb0'):(c?'#e3262f':'#ff7ac8');
  const shirt=who==='kai'?(c?'#ffd400':'#35295e'):(c?'#1fa2ff':'#ffffff');
  let s=`<svg viewBox="0 0 100 130" class="ch">`;
  s+=`<path d="M16 130 Q18 93 50 91 Q82 93 84 130Z" fill="${shirt}" stroke="${ol}" stroke-width="${sw}"/>`;
  if(who==='kai')s+=`<path d="M40 92 L50 106 L60 92" fill="none" stroke="${c?'#111':'#fff'}" stroke-width="${c?3:2}"/><path d="M50 106 L46 128 L50 132 L54 128Z" fill="${c?'#e3262f':'#ff7ac8'}"/>`;
  else s+=`<path d="M30 96 Q50 108 70 96 L68 104 Q50 114 32 104Z" fill="${c?'#ffd400':'#8b6dff'}" stroke="${ol}" stroke-width="${c?2.5:1}"/>`;
  s+=`<rect x="44" y="82" width="12" height="11" fill="${skin}"/>`;
  if(who==='miko')s+=`<circle cx="22" cy="28" r="13" fill="${hair}" stroke="${ol}" stroke-width="${sw}"/><circle cx="78" cy="28" r="13" fill="${hair}" stroke="${ol}" stroke-width="${sw}"/><path d="M19 56 Q12 80 22 92 Q26 72 24 58Z M81 56 Q88 80 78 92 Q74 72 76 58Z" fill="${hair}" stroke="${ol}" stroke-width="${sw}"/>`;
  s+=`<ellipse cx="50" cy="56" rx="30" ry="31" fill="${skin}" stroke="${ol}" stroke-width="${sw}"/>`;
  if(who==='kai')s+=`<path d="M19 55 Q14 24 34 18 L31 6 L45 15 L52 2 L59 15 L72 6 L69 20 Q88 28 81 55 Q77 38 64 35 L58 44 L51 33 L43 42 L38 33 Q25 38 19 55Z" fill="${hair}" stroke="${ol}" stroke-width="${sw}" stroke-linejoin="round"/>`;
  else s+=`<path d="M19 58 Q15 22 50 21 Q85 22 81 58 Q78 41 70 37 Q63 47 53 38 Q44 49 33 40 Q25 45 19 58Z" fill="${hair}" stroke="${ol}" stroke-width="${sw}" stroke-linejoin="round"/>`;
  if(!c)s+=`<path d="M30 30 Q40 24 52 26" stroke="rgba(255,255,255,.55)" stroke-width="3" fill="none" stroke-linecap="round"/>`;
  s+=eyes(38,mood,who,c)+eyes(62,mood,who,c);
  if(who==='kai')s+=`<rect x="27" y="50" width="22" height="18" rx="6" fill="rgba(255,255,255,.15)" stroke="${c?'#111':'#35295e'}" stroke-width="2.2"/><rect x="51" y="50" width="22" height="18" rx="6" fill="rgba(255,255,255,.15)" stroke="${c?'#111':'#35295e'}" stroke-width="2.2"/><path d="M49 57 L51 57" stroke="${c?'#111':'#35295e'}" stroke-width="2.2"/>`;
  if(!c)s+=`<ellipse cx="29" cy="71" rx="5" ry="2.6" fill="#ff9fc0" opacity=".7"/><ellipse cx="71" cy="71" rx="5" ry="2.6" fill="#ff9fc0" opacity=".7"/>`;
  else s+=`<path d="M50 64 L47 70 L51 70" stroke="#111" stroke-width="2" fill="none"/>`;
  s+=mouth(mood,c);
  if(mood==='think')s+=`<text x="84" y="22" font-size="22" font-weight="900" fill="${c?'#111':'#7c5cff'}" font-family="sans-serif">?</text>`;
  if(mood==='shock'&&!c)s+=`<path d="M82 30 q4 8 0 10 q-4 -2 0 -10Z" fill="#7fd0ff"/>`;
  if(mood==='happy'||mood==='wink')s+=c?`<path d="M86 14 l3 7 l7 1 l-5 5 l1 7 l-6 -4 l-6 4 l1 -7 l-5 -5 l7 -1Z" fill="#ffd400" stroke="#111" stroke-width="2"/>`:`<path d="M86 16 l2 6 l6 2 l-6 2 l-2 6 l-2 -6 l-6 -2 l6 -2Z" fill="#fff"/>`;
  return s+'</svg>';
}
function prop(n,cls){
  cls=cls||'prop';
  const c=G.style==='comic',o=c?'#111':'#3b2a66',w=c?4:2.5,W=c?'#000':'#fff';
  const st=`stroke="${o}" stroke-width="${w}"`;
  const P={
  funnel:`<path d="M8 12 H92 L80 32 H20Z" fill="var(--p1)" ${st}/><path d="M21 35 H79 L69 53 H31Z" fill="var(--p2)" ${st}/><path d="M32 56 H68 L61 72 H39Z" fill="var(--p3)" ${st}/><path d="M40 75 H60 L57 92 H43Z" fill="var(--p4)" ${st}/>`,
  steps:`<path d="M6 92 H30 V70 H52 V48 H74 V26 H94 V92Z" fill="var(--p2)" ${st} stroke-linejoin="round"/><g font-family="sans-serif" font-weight="900" font-size="14" fill="${W}" text-anchor="middle"><text x="18" y="86">1</text><text x="41" y="86">2</text><text x="63" y="86">3</text><text x="84" y="86">4</text></g><path d="M80 6 L80 24 M80 6 L94 11 L80 16" fill="var(--p1)" ${st}/>`,
  search:`<rect x="6" y="10" width="88" height="22" rx="11" fill="#fff" ${st}/><circle cx="20" cy="21" r="5" fill="none" stroke="${o}" stroke-width="2.5"/><rect x="32" y="18" width="40" height="6" rx="3" fill="var(--p2)"/><rect x="6" y="42" width="88" height="16" rx="4" fill="var(--p4)" ${st}/><text x="12" y="54" font-family="sans-serif" font-weight="900" font-size="10" fill="${o}">#1</text><rect x="6" y="64" width="88" height="12" rx="4" fill="#fff" ${st}/><rect x="6" y="81" width="88" height="12" rx="4" fill="#fff" ${st} opacity=".7"/>`,
  ad:`<path d="M14 40 L54 22 V78 L14 60Z" fill="var(--p1)" ${st} stroke-linejoin="round"/><rect x="6" y="40" width="12" height="20" rx="3" fill="var(--p2)" ${st}/><path d="M22 60 L28 84 H38 L32 62" fill="var(--p2)" ${st}/><g ${st} stroke-linecap="round"><path d="M64 34 L80 24"/><path d="M66 50 H88"/><path d="M64 66 L80 76"/></g>`,
  phone:`<rect x="26" y="4" width="48" height="92" rx="9" fill="#fff" ${st}/><rect x="32" y="14" width="36" height="40" rx="4" fill="var(--p2)"/><path d="M50 46 C30 32 38 20 50 30 C62 20 70 32 50 46Z" fill="var(--p1)" stroke="${o}" stroke-width="2"/><rect x="32" y="62" width="30" height="5" rx="2.5" fill="${o}" opacity=".4"/><circle cx="82" cy="20" r="10" fill="var(--p4)" stroke="${o}" stroke-width="2.5"/>`,
  pen:`<path d="M14 8 H60 L76 24 V92 H14Z" fill="#fff" ${st} stroke-linejoin="round"/><g fill="var(--p2)"><rect x="22" y="32" width="44" height="6" rx="3"/><rect x="22" y="44" width="36" height="5" rx="2.5" opacity=".6"/><rect x="22" y="54" width="40" height="5" rx="2.5" opacity=".6"/></g><path d="M62 86 L90 46 L98 52 L70 92 L60 96Z" fill="var(--p4)" ${st} stroke-linejoin="round"/>`,
  mail:`<rect x="8" y="22" width="84" height="58" rx="6" fill="#fff" ${st}/><path d="M8 26 L50 58 L92 26" fill="var(--p1)" ${st} stroke-linejoin="round"/><circle cx="84" cy="22" r="11" fill="var(--p3)" stroke="${o}" stroke-width="2.5"/>`,
  chart:`<path d="M10 90 H94" ${st}/><rect x="16" y="62" width="14" height="28" fill="var(--p3)" ${st}/><rect x="36" y="48" width="14" height="42" fill="var(--p2)" ${st}/><rect x="56" y="36" width="14" height="54" fill="var(--p1)" ${st}/><rect x="76" y="20" width="14" height="70" fill="var(--p4)" ${st}/><path d="M12 58 L40 36 L58 44 L90 10" fill="none" ${st} stroke-linecap="round"/>`,
  target:`<circle cx="46" cy="54" r="40" fill="var(--p1)" ${st}/><circle cx="46" cy="54" r="28" fill="#fff" ${st}/><circle cx="46" cy="54" r="16" fill="var(--p2)" ${st}/><circle cx="46" cy="54" r="6" fill="var(--p4)"/><path d="M46 54 L90 10" ${st}/><path d="M84 6 L96 4 L94 16Z" fill="var(--p3)" stroke="${o}" stroke-width="2"/>`,
  coffee:`<path d="M18 40 H74 L68 90 Q66 96 58 96 H34 Q26 96 24 90Z" fill="#fff" ${st}/><path d="M74 50 Q94 52 86 70 Q80 78 70 76" fill="none" ${st}/><rect x="22" y="56" width="50" height="14" fill="var(--p1)"/><g stroke="var(--p2)" stroke-width="${w}" fill="none" stroke-linecap="round"><path d="M34 32 q-6 -8 0 -14 q6 -6 0 -14"/><path d="M48 32 q-6 -8 0 -14 q6 -6 0 -14"/><path d="M62 32 q-6 -8 0 -14 q6 -6 0 -14"/></g>`,
  trophy:`<path d="M28 10 H72 V40 Q72 62 50 64 Q28 62 28 40Z" fill="var(--p4)" ${st}/><path d="M28 18 H12 Q12 40 30 42 M72 18 H88 Q88 40 70 42" fill="none" ${st}/><rect x="44" y="64" width="12" height="14" fill="var(--p4)" ${st}/><rect x="30" y="78" width="40" height="12" rx="3" fill="var(--p2)" ${st}/>`,
  bulb:`<path d="M50 8 C28 8 18 26 22 42 C25 54 36 60 36 72 H64 C64 60 75 54 78 42 C82 26 72 8 50 8Z" fill="var(--p4)" ${st}/><rect x="36" y="74" width="28" height="9" rx="3" fill="#fff" ${st}/><rect x="40" y="84" width="20" height="9" rx="3" fill="#fff" ${st}/><path d="M44 50 L50 38 L56 50" fill="none" stroke="${o}" stroke-width="3"/>`,
  code:`<rect x="6" y="14" width="88" height="72" rx="8" fill="#1a1530" ${st}/><rect x="6" y="14" width="88" height="14" rx="8" fill="var(--p2)" ${st}/><g stroke-width="5" stroke-linecap="round" stroke-linejoin="round" fill="none"><path d="M34 44 L22 56 L34 68" stroke="var(--p3)"/><path d="M66 44 L78 56 L66 68" stroke="var(--p3)"/><path d="M56 40 L44 72" stroke="var(--p1)"/></g>`,
  brain:`<path d="M50 14 C40 6 22 10 22 26 C10 30 10 48 20 54 C14 66 26 80 38 76 C42 88 58 88 62 76 C74 80 86 66 80 54 C90 48 90 30 78 26 C78 10 60 6 50 14Z" fill="var(--p1)" ${st}/><path d="M50 14 V82 M34 32 Q42 36 40 46 M66 32 Q58 36 60 46 M30 58 Q40 56 44 64 M70 58 Q60 56 56 64" fill="none" stroke="${o}" stroke-width="${w*.7}" stroke-linecap="round"/><circle cx="84" cy="14" r="6" fill="var(--p4)" ${st}/>`,
  shield:`<path d="M50 6 L86 18 V46 C86 70 68 86 50 94 C32 86 14 70 14 46 V18Z" fill="var(--p2)" ${st}/><path d="M50 18 L74 26 V46 C74 62 62 74 50 80Z" fill="var(--p3)"/><path d="M36 50 L46 60 L66 38" fill="none" stroke="${W}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>`,
  cloud:`<path d="M26 76 C12 76 6 64 12 54 C8 40 22 30 34 36 C38 20 62 16 70 32 C84 28 96 42 90 56 C98 66 90 78 78 76Z" fill="#fff" ${st}/><g fill="var(--p2)" ${st}><rect x="32" y="50" width="12" height="16" rx="2"/><rect x="48" y="44" width="12" height="22" rx="2"/><rect x="64" y="54" width="10" height="12" rx="2"/></g>`,
  coin:`<ellipse cx="50" cy="70" rx="36" ry="12" fill="var(--p4)" ${st}/><path d="M14 58 V70 M86 58 V70" ${st}/><ellipse cx="50" cy="58" rx="36" ry="12" fill="var(--p4)" ${st}/><circle cx="50" cy="32" r="24" fill="var(--p4)" ${st}/><text x="50" y="42" text-anchor="middle" font-family="sans-serif" font-weight="900" font-size="28" fill="${o}">$</text>`,
  gear:`<path d="M44 6 H56 L58 18 L68 22 L78 14 L86 22 L78 32 L82 42 L94 44 V56 L82 58 L78 68 L86 78 L78 86 L68 78 L58 82 L56 94 H44 L42 82 L32 78 L22 86 L14 78 L22 68 L18 58 L6 56 V44 L18 42 L22 32 L14 22 L22 14 L32 22 L42 18Z" fill="var(--p2)" ${st} stroke-linejoin="round"/><circle cx="50" cy="50" r="14" fill="#fff" ${st}/>`,
  mic:`<rect x="36" y="6" width="28" height="50" rx="14" fill="var(--p1)" ${st}/><path d="M24 40 C24 64 76 64 76 40" fill="none" ${st}/><path d="M50 62 V82 M34 88 H66" ${st} stroke-linecap="round"/><g stroke="var(--p4)" stroke-width="${w}" stroke-linecap="round"><path d="M12 24 L4 20"/><path d="M12 36 H2"/><path d="M88 24 L96 20"/><path d="M88 36 H98"/></g>`,
  clock:`<circle cx="50" cy="52" r="40" fill="#fff" ${st}/><circle cx="50" cy="52" r="32" fill="var(--p3)" opacity=".35"/><path d="M50 52 V28 M50 52 L66 62" stroke="${o}" stroke-width="${w+1}" stroke-linecap="round"/><circle cx="50" cy="52" r="4" fill="${o}"/><path d="M20 12 L8 24 M80 12 L92 24" ${st} stroke-linecap="round"/>`,
  rocket:`<path d="M50 4 C70 16 76 40 70 66 H30 C24 40 30 16 50 4Z" fill="#fff" ${st}/><circle cx="50" cy="34" r="9" fill="var(--p2)" ${st}/><path d="M30 50 L14 70 L30 66Z M70 50 L86 70 L70 66Z" fill="var(--p1)" ${st}/><path d="M38 68 L50 96 L62 68Z" fill="var(--p4)" ${st}/>`,
  book:`<path d="M50 20 C38 12 20 12 8 16 V86 C20 82 38 82 50 90 C62 82 80 82 92 86 V16 C80 12 62 12 50 20Z" fill="#fff" ${st} stroke-linejoin="round"/><path d="M50 20 V90" ${st}/><g fill="var(--p2)"><rect x="16" y="28" width="26" height="5" rx="2.5"/><rect x="16" y="40" width="22" height="5" rx="2.5" opacity=".6"/><rect x="58" y="28" width="26" height="5" rx="2.5"/><rect x="58" y="40" width="22" height="5" rx="2.5" opacity=".6"/></g>`,
  grid:`<rect x="8" y="12" width="84" height="76" rx="6" fill="#fff" ${st}/><rect x="8" y="12" width="84" height="16" rx="6" fill="var(--p4)" ${st}/><g stroke="${o}" stroke-width="${w*.6}"><path d="M8 46 H92 M8 66 H92 M36 12 V88 M64 12 V88"/></g><rect x="38" y="48" width="24" height="16" fill="var(--p3)" opacity=".8"/><text x="18" y="25" font-family="sans-serif" font-weight="900" font-size="11" fill="${o}">fx</text>`,
  db:`<ellipse cx="50" cy="20" rx="34" ry="12" fill="var(--p2)" ${st}/><path d="M16 20 V80 C16 96 84 96 84 80 V20" fill="var(--p2)" ${st}/><path d="M16 40 C16 56 84 56 84 40 M16 60 C16 76 84 76 84 60" fill="none" ${st}/><ellipse cx="50" cy="20" rx="34" ry="12" fill="var(--p3)" ${st}/>`,
  heart:`<path d="M50 88 C10 60 6 34 20 22 C32 12 46 18 50 30 C54 18 68 12 80 22 C94 34 90 60 50 88Z" fill="var(--p1)" ${st}/><path d="M26 30 Q30 24 38 26" stroke="#fff" stroke-width="4" fill="none" stroke-linecap="round"/>`,
  layout:`<rect x="6" y="10" width="88" height="80" rx="8" fill="#fff" ${st}/><rect x="6" y="10" width="88" height="14" rx="8" fill="var(--p2)" ${st}/><rect x="14" y="32" width="34" height="50" rx="4" fill="var(--p3)" opacity=".6"/><rect x="54" y="32" width="32" height="10" rx="3" fill="var(--p1)"/><rect x="54" y="48" width="32" height="6" rx="3" fill="${o}" opacity=".3"/><rect x="54" y="60" width="24" height="12" rx="6" fill="var(--p4)" ${st}/>`,
  people:`<circle cx="50" cy="28" r="14" fill="var(--p4)" ${st}/><path d="M24 80 C24 56 76 56 76 80Z" fill="var(--p2)" ${st}/><circle cx="20" cy="44" r="10" fill="#fff" ${st}/><path d="M2 86 C2 66 38 66 38 86Z" fill="var(--p3)" ${st}/><circle cx="80" cy="44" r="10" fill="#fff" ${st}/><path d="M62 86 C62 66 98 66 98 86Z" fill="var(--p1)" ${st}/>`,
  dice:`<rect x="10" y="20" width="56" height="56" rx="10" fill="#fff" ${st} transform="rotate(-10 38 48)"/><g fill="${o}"><circle cx="26" cy="38" r="5"/><circle cx="38" cy="48" r="5"/><circle cx="50" cy="58" r="5"/></g><rect x="50" y="44" width="42" height="42" rx="8" fill="var(--p1)" ${st} transform="rotate(12 71 65)"/><g fill="#fff"><circle cx="64" cy="58" r="4"/><circle cx="78" cy="72" r="4"/></g>`,
  globe:`<circle cx="50" cy="50" r="40" fill="var(--p3)" ${st}/><path d="M50 10 C32 30 32 70 50 90 C68 70 68 30 50 10Z M10 50 H90 M16 30 H84 M16 70 H84" fill="none" stroke="${o}" stroke-width="${w*.7}"/>`
  };
  return `<svg viewBox="0 0 100 100" class="${cls}" aria-hidden="true">${P[n]||P.bulb}</svg>`;
}

/* ---------------- comic generation (deterministic) ---------------- */
const NAMES={kai:'Sensei Kai',miko:'Miko',algo:'The Algorithm'};
const BGS=['speed','dots','city','burst'];
const MOODS_K=['smile','wink','determined','happy'];
const MOODS_M=['happy','think','shock','determined'];

function overview(C){
  const h=hash(C.id), P=C.pillars;
  const pillarPanel=(p,i)=>({bg:BGS[(h+i)%4],cap:`Building block #${i+1} — ${p[0]}`,c:[[i%3===2?'miko':'kai',i%3===2?'happy':pick(MOODS_K,h+i)]],prop:p[1],s:[[i%3===2?'miko':'kai',p[2]]]});
  return {title:'Episode 0 · The Big Picture',sub:'Round 1 — just read and enjoy. No tests yet.',pages:[
   [
    {w:1,bg:'city',cap:'A learner on a mission.',sfx:'WHOOSH!',c:[['miko','shock'],['kai','happy']],
     s:[['miko',`I want to learn ${C.title}. Where do I even start?`],['kai','I\'m Kai, your sensei. We start from the clouds, then zoom in.']]},
    {bg:'speed',c:[['kai','smile']],prop:C.icon,s:[['kai',C.hook]]},
    {bg:'dots',c:[['miko','think'],['kai','wink']],s:[['miko','Can you give me an example?'],['kai',C.example]]}
   ],
   [
    {w:1,bg:'burst',cap:`The map: ${C.map.name}`,c:[['kai','determined']],prop:'steps',
     s:[['kai',C.map.steps.map((x,i)=>`${i+1}. **${x}**`).join('  →  ')]]},
    {bg:'dots',c:[['kai','smile']],s:[['kai',C.map.explain]]},
    {bg:'speed',sfx:'DING!',c:[['miko','happy'],['kai','wink']],s:[['miko','So each stage needs different skills?'],['kai','Exactly. Now meet the six building blocks.']]}
   ],
   P.slice(0,3).map(pillarPanel),
   [
    ...P.slice(3,6).map((p,i)=>pillarPanel(p,i+3)),
    {w:1,bg:'night',sfx:'DUN DUN DUNNN',c:[['algo','laugh'],['miko','shock']],
     s:[['algo',`MWAHAHA. Nobody masters ${C.title} without passing MY tests!`],['miko','W-who is THAT?!']]},
    {w:1,bg:'burst',c:[['kai','determined'],['miko','determined']],
     s:[['kai','The Algorithm. To beat it, you train. Pick the topics you want to go deeper on…'],['miko','…and each round I get tested. Let\'s DO this!']]}
   ]
  ]};
}
function topicEp(C,t,n){
  const h=hash(C.id+t.id), L=t.learn;
  const learnPanel=(l,i,wide)=>({w:wide?1:0,bg:BGS[(h+i)%4],cap:l[0],c:[['kai',pick(MOODS_K,h+i)],['miko',pick(MOODS_M,h+i+1)]],
    s:[['kai',`**${l[0]}**: ${l[1]}`],['miko',`Example: ${l[2]}`]]});
  return {title:`Episode ${n} · ${t.name}`,sub:'Round 2 — interactive. Answer the skill checks to turn the page.',pages:[
   [
    {w:1,bg:'speed',cap:`Episode ${n} · ${t.name}`,c:[['miko','think'],['kai','smile']],prop:t.icon,
     s:[['miko',`Okay, Sensei. Teach me ${t.name}!`],['kai',t.blurb]]},
    learnPanel(L[0],0),learnPanel(L[1],1),
    Object.assign({quiz:1},Q(t.checks[0]))
   ],
   [
    learnPanel(L[2],2,1),
    {bg:'dots',c:[['miko','happy']],prop:t.icon,s:[['miko',`Recap: **${L[0][0]}**, **${L[1][0]}**, **${L[2][0]}**. Got it!`]]},
    {bg:'burst',c:[['kai','wink']],s:[['kai','One more check before the boss shows up. Read carefully.']]},
    Object.assign({quiz:1},Q(t.checks[1]))
   ],
   [
    {w:1,bg:'night',sfx:'BZZT!',c:[['algo','laugh'],['miko','determined']],
     s:[['algo',`You think you know ${t.name}? PROVE IT, human.`],['miko','Bring it on!']]}
   ]
  ]};
}

/* ---------------- rendering ---------------- */
let QA={},current=null;
function panelHTML(p,i,qkey){
  if(p.quiz)return quizPanel(p,i,qkey);
  const chars=p.c||[];
  let h=`<div class="panel ${p.w?'wide':''} bg-${p.bg||'dots'}" style="animation-delay:${i*.12}s">`;
  if(p.sfx)h+=`<div class="sfx">${esc(p.sfx)}</div>`;
  if(p.cap)h+=`<div class="cap">${esc(p.cap)}</div>`;
  h+=`<div class="bubbles">`;
  (p.s||[]).forEach(([who,t],k)=>{
    const idx=chars.findIndex(c=>c[0]===who);
    h+=`<div class="bub ${idx===1?'r':'l'} ${who==='algo'?'algo':''}" style="animation-delay:${i*.12+.25+k*.35}s"><span class="who">${NAMES[who]}</span>${md(t)}</div>`;
  });
  h+=`</div><div class="stage">`;
  if(chars[0])h+=`<div>${char(chars[0][0],chars[0][1])}</div>`;
  if(p.prop)h+=prop(p.prop);
  if(chars[1])h+=`<div class="flip">${char(chars[1][0],chars[1][1])}</div>`;
  else if(!p.prop)h+='<div></div>';
  return h+`</div></div>`;
}
function quizPanel(p,i,qkey){
  const ans=QA[qkey];
  let h=`<div class="panel wide quiz bg-burst" style="animation-delay:${i*.12}s"><div style="display:flex;gap:12px;align-items:flex-end">
    <div style="width:90px;flex:none">${char(p.who||'kai',ans==null?'think':(ans===p.a?'happy':'shock'))}</div>
    <div class="qcard" style="flex:1"><span class="qtag">⚡ SKILL CHECK</span><div class="qt">${esc(p.q)}</div><div class="opts">`;
  p.o.forEach((o,k)=>{let cls='';if(ans!=null){if(k===p.a)cls='ok';else if(k===ans)cls='no';}
    h+=`<button class="opt ${cls}" ${ans!=null?'disabled':''} data-q="${qkey}" data-k="${k}">${esc(o)}</button>`;});
  h+=`</div>${ans!=null?`<div class="explain"><b>${ans===p.a?'Nailed it! +100 XP':'Not quite. +20 XP for trying'}</b> — ${esc(p.e)}</div>`:''}</div></div></div>`;
  return h;
}
function setStyle(s){G.style=s;document.body.className=s;saveG();
  document.querySelectorAll('#styleToggle button').forEach(b=>b.classList.toggle('on',b.dataset.s===s));
  if(current)current();}
function addXP(n){G.xp+=n;saveG();renderXP();}
function renderXP(){$('#xpv').textContent=G.xp;$('#xpb').style.width=Math.min(100,(G.xp%1000)/10)+'%';}
function go(fn){current=fn;fn();window.scrollTo({top:0,behavior:'smooth'});}
const T=k=>COURSE.topics.find(t=>t.id===k);
const seo=()=>$('#seo');
const showSeo=v=>{const n=seo();if(n)n.style.display=v?'':'none'};

/* ---------------- course screens ---------------- */
function courseHome(){
  showSeo(true);
  const C=COURSE,started=S.seenOverview;
  app.innerHTML=`<div class="wrap fade">
  <div class="crumb"><a href="${ROOT}index.html">All courses</a> / ${esc(C.cat)}</div>
  <section class="hero" style="padding-top:28px">
   <div>
    <div class="eyebrow"><span class="beta">PREVIEW</span> Comic course · ${esc(C.cat)}</div>
    <h1>Learn <em>${esc(C.title)}</em> as a comic.</h1>
    <p class="lead">${esc(C.tagline)} Start with the big picture, pick topics to go deeper, then beat the boss.</p>
    <div style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn" id="start">${started?'Continue ▸':'Start episode 0 ▸'}</button>${started?'<button class="btn ghost" id="restart">Start over</button>':''}</div>
    <div class="stylepick">
      <button class="sp ${G.style==='anime'?'on':''}" data-s="anime"><div class="sw an"><span>キラキラ ✦</span></div><b>Anime</b><small>Soft gradients, speed lines, sparkle energy</small></button>
      <button class="sp ${G.style==='comic'?'on':''}" data-s="comic"><div class="sw co"><span>KA-POW!</span></div><b>Comic</b><small>Bold ink, halftone dots, punchy SFX</small></button>
    </div>
   </div>
   <div class="heroart">
    <div class="mini" style="left:0;top:0;width:54%;z-index:1">${panelHTML({bg:'speed',c:[['miko','happy']],prop:C.icon,s:[['miko',`${C.title}, but make it a story!`]]},0)}</div>
    <div class="mini" style="right:0;top:12%;width:50%;z-index:3;animation-delay:-2s">${panelHTML({bg:'night',sfx:'BZZT!',c:[['algo','laugh']],s:[['algo','Prove your skill!']]},1)}</div>
    <div class="mini" style="left:18%;bottom:0;width:52%;z-index:2;animation-delay:-4s">${panelHTML({bg:'dots',c:[['kai','wink']],prop:C.topics[0].icon,s:[['kai',`**${C.topics[0].learn[0][0]}**, explained.`]]},2)}</div>
   </div>
  </section></div>`;
  app.querySelectorAll('.sp').forEach(b=>b.onclick=()=>setStyle(b.dataset.s));
  $('#start').onclick=()=>{track('course_start',{course:C.id,style:G.style});go(started&&S.picked.length?hub:()=>reader('overview',0));};
  const r=$('#restart');if(r)r.onclick=()=>{S=freshC();saveS();go(()=>reader('overview',0));};
  current=courseHome;
}
function epFor(id){
  if(id==='overview')return overview(COURSE);
  if(id==='mission')return {title:'Round 3 · Final Mission',pages:[[{w:1,bg:'city',cap:'Final Mission',sfx:'GO!',c:[['kai','determined'],['miko','happy']],prop:COURSE.mission.prop||COURSE.icon,
    s:[['kai',COURSE.mission.setup],['miko','My first real test. Every decision counts.']]}]]};
  const i=COURSE.topics.findIndex(t=>t.id===id);return topicEp(COURSE,COURSE.topics[i],i+1);
}
function reader(id,pg){
  showSeo(false);
  const ep=epFor(id);
  if(pg===0&&!reader._keep)QA={};
  reader._keep=false;
  const page=ep.pages[pg];
  const qkeys=page.map((p,i)=>p.quiz?`${id}-${pg}-${i}`:null);
  const pending=qkeys.some(k=>k&&QA[k]==null);
  const last=pg===ep.pages.length-1;
  app.innerHTML=`<div class="wrap reader">
   <div class="rhead"><div><div class="eyebrow">${id==='overview'?'Round 1 · Overview':id==='mission'?'Round 3':'Round 2 · Deep dive'} · ${esc(COURSE.title)}</div><h2>${esc(ep.title)}</h2>${ep.sub?`<div class="muted" style="margin-top:6px;font-size:14px">${ep.sub}</div>`:''}</div>
   <div class="dots">${ep.pages.map((_,k)=>`<i class="${k<=pg?'on':''}"></i>`).join('')}</div></div>
   <div class="page">${page.map((p,i)=>panelHTML(p,i,qkeys[i])).join('')}</div>
   <div class="navrow">
     <button class="btn ghost" id="prev">${pg===0?'✕ Exit':'◂ Back'}</button>
     <span class="hint">${pending?'Answer the skill check to continue':`Page ${pg+1} of ${ep.pages.length}`}</span>
     <button class="btn" id="next" ${pending?'disabled':''}>${!last?'Next page ▸':(id==='overview'?'Choose my topics ▸':id==='mission'?'Start mission ▸':'Fight the boss ⚔')}</button>
   </div></div>`;
  app.querySelectorAll('.opt').forEach(b=>b.onclick=()=>{
    const k=b.dataset.q,choice=+b.dataset.k,[pp,ii]=k.split('-').slice(-2).map(Number);
    const q=ep.pages[pp][ii];QA[k]=choice;const ok=choice===q.a;addXP(ok?100:20);
    if(T(id)){const sc=S.scores[id]||(S.scores[id]={c:0,t:0,checks:{}});if(sc.checks[k]==null){sc.checks[k]=ok;sc.c+=ok?1:0;sc.t++;saveS();}}
    reader._keep=true;reader(id,pg);
  });
  $('#prev').onclick=()=>{if(pg===0)go(id==='overview'?courseHome:hub);else{reader._keep=true;go(()=>reader(id,pg-1));}};
  $('#next').onclick=()=>{
    if(!last){reader._keep=true;go(()=>reader(id,pg+1));}
    else if(id==='overview'){S.seenOverview=true;saveS();track('round1_complete',{course:COURSE.id});go(picker);}
    else go(()=>boss(id));
  };
  current=()=>{reader._keep=true;reader(id,pg)};
}
function picker(){
  showSeo(false);
  const sel=new Set(S.picked);
  const draw=()=>{
  app.innerHTML=`<div class="wrap sec fade">
   <div class="eyebrow">Round 1 complete ✓</div>
   <h2>Where do you want to go deeper?</h2>
   <p class="muted">Pick 1–3 topics for this season. Each becomes an interactive episode with skill checks and a boss battle.</p>
   <div class="grid3">${COURSE.topics.map(t=>`<button class="tcard ${sel.has(t.id)?'on':''}" data-k="${t.id}"><span class="check">${sel.has(t.id)?'✓':''}</span>${prop(t.icon,'ic')}<h3>${esc(t.name)}</h3><p>${esc(t.blurb)}</p>${S.done[t.id]?'<span class="st done">Completed</span>':''}</button>`).join('')}</div>
   <div class="barfoot"><span>${sel.size}/3 selected</span><button class="btn" id="go" ${sel.size?'':'disabled'}>Start season ▸</button></div></div>`;
  app.querySelectorAll('.tcard').forEach(b=>b.onclick=()=>{const k=b.dataset.k;if(sel.has(k))sel.delete(k);else if(sel.size<3)sel.add(k);draw();});
  $('#go').onclick=()=>{S.picked=[...sel];saveS();track('topics_picked',{course:COURSE.id,topics:S.picked.join(',')});go(hub);};
  };
  draw();current=draw;
}
function hub(){
  showSeo(false);
  const allDone=S.picked.every(k=>S.done[k]);
  app.innerHTML=`<div class="wrap sec fade">
   <div class="eyebrow">${esc(COURSE.title)} · Your season</div>
   <h2>Training route</h2>
   <p class="muted">Clear each episode, then the final mission unlocks.</p>
   <div class="grid3">${S.picked.map((k,i)=>{const t=T(k),sc=S.scores[k];
     return `<button class="tcard" data-k="${k}">${prop(t.icon,'ic')}<h3>${i+1}. ${esc(t.name)}</h3><p>${esc(t.blurb)}</p>
      <span class="st ${S.done[k]?'done':''}">${S.done[k]?`Cleared · ${sc.c}/${sc.t} correct`:'Play episode ▸'}</span></button>`}).join('')}</div>
   <div class="mission ${allDone?'unlocked':''}">${prop(COURSE.mission.prop||COURSE.icon,'ic')}<div style="flex:1"><h3 style="font-size:22px">Final Mission</h3><p class="muted" style="font-size:14px">${allDone?'Unlocked! Make real decisions using everything you learned.':'Locked. Clear your episodes first.'}</p></div>
     <button class="btn" id="ms" ${allDone?'':'disabled'}>${S.mission?'Replay':'Start'} ▸</button></div>
   <div style="display:flex;gap:10px;margin-top:22px;flex-wrap:wrap">
    <button class="btn ghost" id="more">＋ Add / change topics</button>
    <button class="btn ghost" id="ov">↺ Re-read overview</button>
    ${S.mission?'<button class="btn ghost" id="rep">View report card</button>':''}
   </div></div>`;
  app.querySelectorAll('.tcard').forEach(b=>b.onclick=()=>{const k=b.dataset.k;
    delete S.done[k];S.scores[k]={c:0,t:0,checks:{}};saveS();go(()=>reader(k,0));});
  $('#ms').onclick=()=>go(()=>reader('mission',0));
  $('#more').onclick=()=>go(picker);
  $('#ov').onclick=()=>go(()=>reader('overview',0));
  const r=$('#rep');if(r)r.onclick=()=>go(report);
  current=hub;
}
function boss(id){
  const isM=id==='mission';
  const qs=(isM?COURSE.mission.steps:T(id).boss).map(x=>Q(x));
  let qi=0,foe=100,you=100,ans=null,correct=0;
  const dmg=Math.ceil(100/qs.length);
  const draw=(fx)=>{
    const q=qs[qi];
    app.innerHTML=`<div class="wrap reader fade">
     <div class="rhead"><div><div class="eyebrow">${isM?'Round 3 · Final mission':'Boss battle · '+esc(T(id).name)}</div><h2>${isM?esc(COURSE.title)+': mission':'VS. The Algorithm'}</h2></div>
     <div class="dots">${qs.map((_,k)=>`<i class="${k<=qi?'on':''}"></i>`).join('')}</div></div>
     <div class="arena">
      <div class="foe panel bg-${isM?'city':'night'} ${fx==='hit'?'hit':''}" style="animation:none">
        ${isM?`<div class="hp y"><label><span>MISSION HEALTH</span><span>${you}%</span></label><div class="b"><i style="width:${you}%"></i></div></div>`
          :`<div class="hp e"><label><span>THE ALGORITHM</span><span>${foe}</span></label><div class="b"><i style="width:${foe}%"></i></div></div>
            <div class="hp y"><label><span>MIKO (YOU)</span><span>${you}</span></label><div class="b"><i style="width:${you}%"></i></div></div>`}
        ${isM?`<div style="display:flex;align-items:flex-end;justify-content:center;gap:10px;margin-top:auto;height:230px">${char('miko',ans==null?'determined':ans===q.a?'happy':'shock').replace('class="ch"','class="ch" style="height:210px;margin:0"')}${prop(COURSE.mission.prop||COURSE.icon)}</div>`
          :char('algo',fx==='hit'?'hurt':'laugh')}
        ${fx==='hit'?`<div class="dmg">-${dmg} HIT!</div>`:fx==='miss'?`<div class="dmg" style="color:#ff5c8a">OUCH!</div>`:''}
      </div>
      <div class="qbox">
        <span class="pill">${isM?'Decision':'Question'} ${qi+1} / ${qs.length}</span>
        <div class="qt">${esc(q.q)}</div>
        <div class="opts">${q.o.map((o,k)=>{let c='';if(ans!=null){if(k===q.a)c='ok';else if(k===ans)c='no';}
          return `<button class="opt ${c}" data-k="${k}" ${ans!=null?'disabled':''}>${esc(o)}</button>`}).join('')}</div>
        ${ans!=null?`<div class="explain"><b>${ans===q.a?(isM?'Smart call! +150 XP':'Critical hit! +150 XP'):'Missed. +20 XP'}</b> — ${esc(q.e)}</div>
          <div style="margin-top:auto;padding-top:16px;text-align:right"><button class="btn" id="nx">${qi<qs.length-1?'Next ▸':'Finish ▸'}</button></div>`:''}
      </div></div></div>`;
    app.querySelectorAll('.opt').forEach(b=>b.onclick=()=>{
      ans=+b.dataset.k;const ok=ans===q.a;
      if(ok){correct++;foe=Math.max(0,foe-dmg);addXP(150);}else{you=Math.max(0,you-dmg);addXP(20);}
      draw(ok?'hit':'miss');});
    const nx=$('#nx');if(nx)nx.onclick=()=>{if(qi<qs.length-1){qi++;ans=null;draw();}else finish();};
  };
  const finish=()=>{
    if(isM){S.mission={c:correct,t:qs.length};saveS();track('mission_complete',{course:COURSE.id,score:correct});go(report);return;}
    const t=T(id),sc=S.scores[id]||(S.scores[id]={c:0,t:0,checks:{}});sc.c+=correct;sc.t+=qs.length;S.done[id]=true;saveS();
    track('boss_result',{course:COURSE.id,topic:id,correct});
    const win=correct>=Math.ceil(qs.length/2);
    app.innerHTML=`<div class="wrap reader fade"><div class="page">
      ${panelHTML({w:1,bg:win?'burst':'night',sfx:win?'K.O.!':'RETRY?',c:win?[['miko','happy'],['algo','hurt']]:[['miko','determined'],['algo','laugh']],
        s:win?[['miko',`Boss down! ${correct}/${qs.length} correct. ${t.name} cleared!`],['algo','Impossible… I\'ll be back… next episode…']]
             :[['miko',`${correct}/${qs.length}… it got me this time.`],['algo','HAHA! Study the explanations and come back stronger.']]},0)}
      ${panelHTML({w:1,bg:'dots',c:[['kai','wink']],prop:t.icon,s:[['kai',`Episode score: **${sc.c}/${sc.t}** including skill checks. ${win?'Great work. On to the next one!':'Replay it any time from your route.'}`]]},1)}
    </div><div class="navrow"><button class="btn ghost" id="rp">↺ Replay episode</button><button class="btn" id="hb">Back to route ▸</button></div></div>`;
    $('#hb').onclick=()=>go(hub);
    $('#rp').onclick=()=>{delete S.done[id];S.scores[id]={c:0,t:0,checks:{}};saveS();go(()=>reader(id,0));};
    current=null;
  };
  draw();current=()=>draw();
}
function report(){
  const rows=COURSE.topics.filter(t=>S.scores[t.id]&&S.scores[t.id].t).map(t=>({k:t.id,n:t.name,p:Math.round(100*S.scores[t.id].c/S.scores[t.id].t)}));
  if(S.mission)rows.push({k:'mission',n:'Final Mission',p:Math.round(100*S.mission.c/S.mission.t)});
  const avg=rows.length?Math.round(rows.reduce((a,r)=>a+r.p,0)/rows.length):0;
  const rank=avg>=90?'Legend':avg>=75?'Pro':avg>=55?'Rising Star':'Rookie';
  const weak=rows.filter(r=>r.k!=='mission').sort((a,b)=>a.p-b.p)[0];
  const untouched=COURSE.topics.filter(t=>!S.done[t.id]);
  app.innerHTML=`<div class="wrap sec fade">
   <div class="eyebrow">${esc(COURSE.title)} · Season complete</div>
   <h2>Your report card</h2>
   <div class="report">
    <div class="rcard"><div class="muted" style="font-size:13px;font-weight:700;letter-spacing:1px">RANK</div><div class="rank">${esc(COURSE.title)} ${rank}</div>
      <div class="muted">Overall accuracy <b style="color:inherit">${avg}%</b> · ${G.xp} XP</div>
      <div style="display:flex;justify-content:center;margin-top:12px">${prop('trophy','ic" style="width:120px')}</div></div>
    <div class="rcard"><div class="muted" style="font-size:13px;font-weight:700;letter-spacing:1px">SKILLS</div>
      ${rows.map(r=>`<div class="srow"><label><span>${esc(r.n)}</span><span>${r.p}%</span></label><div class="b"><i style="width:${r.p}%"></i></div></div>`).join('')}</div>
    <div class="rcard" style="grid-column:1/-1"><div class="muted" style="font-size:13px;font-weight:700;letter-spacing:1px">WHAT TO DO NEXT</div><ul class="tips">
      ${weak&&weak.p<100?`<li>Replay <b>${esc(weak.n)}</b> (${weak.p}%). It's your weakest area right now.</li>`:''}
      ${untouched.length?`<li>Unexplored topics: <b>${untouched.map(t=>esc(t.name)).join(', ')}</b>. Add them to a new season.</li>`:'<li>You\'ve covered every topic in this course. 🎉</li>'}
      <li>${esc(COURSE.practice)}</li></ul></div>
   </div>
   <div style="display:flex;gap:10px;margin-top:22px;flex-wrap:wrap"><button class="btn" id="ns">New season ▸</button><button class="btn ghost" id="hb">Back to route</button><a class="btn ghost" href="${ROOT}index.html">Explore other courses</a></div>
  </div>`;
  $('#ns').onclick=()=>go(picker);
  $('#hb').onclick=()=>go(hub);
  current=report;
}

/* ---------------- catalog ---------------- */
function catalog(){
  let cat='All',q='';
  const cats=['All',...new Set(CATALOG.map(c=>c.cat))];
  const progress=id=>{try{const s=JSON.parse(localStorage.getItem('koma.c.'+id)||'null');if(!s)return 0;const d=Object.keys(s.done||{}).length;return s.mission?100:Math.min(95,(s.seenOverview?20:0)+d*25)}catch(e){return 0}};
  app.innerHTML=`<div class="wrap fade">
   <section class="cathero">
    <div class="eyebrow"><span class="beta">PREVIEW</span> Learn anything · panel by panel</div>
    <h1>Every subject, <em>as your own comic.</em></h1>
    <p>Pick a course. Read the big picture as a comic, choose what to go deeper on, then prove it in interactive episodes and boss battles. Anime or comic style. Free.</p>
    <form class="field" id="sf" style="max-width:560px"><input id="q" placeholder="Search courses… e.g. Python, investing, leadership" aria-label="Search courses" autocomplete="off"><button class="btn" type="submit">Search</button></form>
    <div class="cats" id="cats"></div>
   </section>
   <div class="cgrid" id="grid"></div>
   <div id="emptyBox"></div>
   <section class="req" id="req">
    <h3>Don't see your topic?</h3>
    <p class="muted" style="font-size:14px">Request it. The most-requested topics get turned into comics next.</p>
    <form class="field" id="rf"><input id="rq" placeholder="What do you want to learn?" aria-label="Request a topic" maxlength="80"><button class="btn" type="submit">Request</button></form>
    <div class="ok" id="rok"></div>
   </section>
  </div>`;
  const drawCats=()=>{$('#cats').innerHTML=cats.map(c=>`<button class="${c===cat?'on':''}" data-c="${esc(c)}">${esc(c)}</button>`).join('');
    document.querySelectorAll('#cats button').forEach(b=>b.onclick=()=>{cat=b.dataset.c;drawCats();drawGrid();});};
  const drawGrid=()=>{
    const ql=q.toLowerCase();
    const list=CATALOG.filter(c=>(cat==='All'||c.cat===cat)&&(!ql||(c.title+' '+c.tagline+' '+(c.keys||'')).toLowerCase().includes(ql)));
    $('#grid').innerHTML=list.map(c=>{const p=progress(c.id);return `<a class="ccard" href="learn/${c.id}/index.html">${prop(c.icon,'ic')}<span class="tag">${esc(c.cat)}</span><h3>${esc(c.title)}</h3><p>${esc(c.tagline)}</p>${p?`<div class="prog"><i style="width:${p}%"></i></div>`:''}</a>`}).join('');
    $('#emptyBox').innerHTML=list.length?'':`<div class="empty">No course for “${esc(q)}” yet. <button class="btn" id="reqq" style="margin-left:8px">Request “${esc(q)}”</button></div>`;
    const rb=$('#reqq');if(rb)rb.onclick=()=>request(q);
  };
  const request=t=>{t=t.trim();if(!t)return;track('topic_request',{topic:t.toLowerCase().slice(0,80)});
    G.requests=[...new Set([...(G.requests||[]),t])].slice(-20);saveG();
    $('#rok').textContent=`Thanks! “${t}” is on the list.`;$('#rq').value='';$('#req').scrollIntoView({behavior:'smooth'});};
  $('#sf').onsubmit=e=>{e.preventDefault();q=$('#q').value.trim();if(q)track('search',{search_term:q.toLowerCase()});drawGrid();};
  $('#q').oninput=e=>{q=e.target.value.trim();drawGrid();};
  $('#rf').onsubmit=e=>{e.preventDefault();request($('#rq').value);};
  drawCats();drawGrid();current=catalog;
}

/* ---------------- boot ---------------- */
document.querySelectorAll('#styleToggle button').forEach(b=>b.onclick=()=>setStyle(b.dataset.s));
document.body.className=G.style;
document.querySelectorAll('#styleToggle button').forEach(b=>b.classList.toggle('on',b.dataset.s===G.style));
renderXP();
if(COURSE)go(courseHome);else if(CATALOG)go(catalog);
})();
