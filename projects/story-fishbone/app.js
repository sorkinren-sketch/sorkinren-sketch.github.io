"use strict";

// ─── 状态 ───
let mainline = [];
let nextId = 1;
let sel = null;        // {target, parentId, id}
let zoom = 1;
let genHistory = [];   // [{time, text, nodes}]
let propOpen = false;
let dragSort = null;

// ─── 蓝图状态 ───
let bpActiveNode = null;   // 当前编辑的鱼骨节点
let bpLinkMode = false;    // 连线模式
let bpLinkFrom = null;     // {nodeId, side} 连线起点
let bpSelLink = null;      // 选中的连线索引或id
let bpNodes = [];          // 当前蓝图节点数组
let bpLinks = [];          // 当前蓝图连线数组 [{fromId, fromSide, toId, type}]
let bpNextId = 1;          // 蓝图节点自增id
let bpDragNode = null;     // 当前拖拽的蓝图节点

const $ = id=>document.getElementById(id);
const esc = s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const uid = ()=>nextId++;

document.addEventListener('DOMContentLoaded',()=>{
  loadProject();
  renderGroups();
  renderMainline();
  setupDrop();
  setupDragSort();
  // 鱼骨图节点单击选中（用事件委托，解决双击冲突）
  document.getElementById('fishboneContainer').addEventListener('click', e => {
    const fb = e.target.closest('.fb-node');
    if(!fb) return;
    // 如果是双击，在 300ms 内再次点击同一个节点，不触发
    const id = parseInt(fb.dataset.id);
    if(fb._clickTimer){ clearTimeout(fb._clickTimer); fb._clickTimer=null; return; }
    fb._clickTimer = setTimeout(()=>{
      fb._clickTimer=null;
      selectNode('main',null,id);
    }, 250);
  });
});

// ═══════════════════════════════════════════════
//  预制模板渲染
// ═══════════════════════════════════════════════
function renderGroups(){
  const q = ($('tplSearch').value||'').toLowerCase();
  $('sbGroups').innerHTML = TPL_GROUPS.map((g,gi)=>{
    const items = g.items.filter(it=>!q||it.label.includes(q)||g.name.includes(q));
    if(!items.length&&q) return '';
    return `<div class="tpl-group">
      <div class="tpl-group-header" onclick="toggleGroup(${gi})">
        <span class="gg-icon">${g.icon}</span>
        <span class="gg-name">${g.name} · ${g.items.length}</span>
        <span class="gg-arrow">▼</span>
      </div>
      <div class="tpl-group-body" id="gb${gi}">
        ${items.map(it=>`
          <div class="tpl-item anim-fade" draggable="true"
               ondragstart="onDragStart(event,'${esc(it.label)}')">
            <span class="ti-icon">${it.icon}</span>
            <span class="ti-label">${esc(it.label)}</span>
          </div>
        `).join('')}
      </div>
    </div>`;
  }).join('');
}
function toggleGroup(i){
  const b=$('gb'+i); const h=b.previousElementSibling;
  if(!b||!h)return; b.classList.toggle('hide'); h.classList.toggle('collapsed');
}

let dragLabel='';
function onDragStart(e,label){ dragLabel=label; e.dataTransfer.setData('text/plain',label); e.dataTransfer.effectAllowed='copy'; }

// ═══════════════════════════════════════════════
//  拖放系统
// ═══════════════════════════════════════════════
function setupDrop(){
  const processed = new WeakSet();
  const targets = [$('fishboneContainer'),$('canvasInner')];
  function drop(e){
    e.preventDefault(); if(processed.has(e)) return; processed.add(e);
    const label = e.dataTransfer.getData('text/plain')||dragLabel; if(!label) return;
    for(const g of TPL_GROUPS) for(const it of g.items){
      if(it.label===label){
        const fields = JSON.parse(JSON.stringify(it.fields));
        const node = {id:uid(), type:getType(it), label:it.label, icon:it.icon, fields, children:[]};
        mainline.push(node);
        // 拖入后自动弹出属性面板
        renderMainline();
        saveProject();
        setTimeout(()=>{ const last = mainline[mainline.length-1]; if(last) openPropPanel(last,'main',null); }, 10);
        return;
      }
    }
  }
  targets.forEach(el=>{if(el){
    el.addEventListener('dragover',e=>e.preventDefault());
    el.addEventListener('drop',function(e){e.stopPropagation();drop(e);});
  }});
}
function getType(it){
  for(const t of Object.keys(TYPE_FIELDS)){
    if(Object.keys(it.fields).some(k=>TYPE_FIELDS[t].some(f=>f.id===k))) return t;
  }
  return 'event';
}

// ═══════════════════════════════════════════════
//  鱼骨图渲染
// ═══════════════════════════════════════════════
function renderMainline(){
  const c=$('fishboneContainer');
  if(!mainline.length){ c.innerHTML='<div class="fb-empty">从左侧拖拽模板到此处</div>'; return; }
  c.innerHTML = '<div class="fishbone">' + mainline.map((n,i)=>renderNode(n,i)).join('') + '</div>';
}

function renderNode(n,i){
  const icon = n.icon||getTypeIcon(n.type);
  const title = n.fields.title||n.fields.name||n.label||getTypeLabel(n.type);
  const desc = getSummary(n);
  const selClass = (sel&&sel.target==='main'&&sel.id===n.id)?' selected':'';
  const tags = buildTags(n);
  const hasCh = n.children&&n.children.length>0;
  const hasBp = n.blueprints && (n.blueprints.nodes||[]).length>0;
  return `<div class="fb-node${selClass}" data-id="${n.id}" data-index="${i}"
       ondblclick="openBlueprint(${n.id})">
    <div class="fb-order">${i+1}</div>
    <div class="fb-top">
      <span class="fb-icon" style="background:${color(n.type)}20;color:${color(n.type)}">${icon}</span>
      <span class="fb-title">${esc(title)}</span>
      ${hasBp?`<span class="fb-badge" style="background:var(--indigo);color:#fff" title="有蓝图">🔗</span>`:''}
      ${hasCh?`<span class="fb-badge">${n.children.length}</span>`:''}
    </div>
    <div class="fb-desc">${esc(desc)}</div>
    ${tags.length?`<div class="fb-tags">${tags.map(t=>`<span class="fb-tag" onclick="event.stopPropagation();editTag(${n.id},'${esc(t)}')">${esc(t)}</span>`).join('')}</div>`:''}
    <div class="nest-level l1${hasCh?' show':''}" id="nest-${n.id}">
      ${hasCh?renderNest(n.children,n.id,2):''}
      <div style="margin-top:6px"><button class="sb-btn-save" style="padding:3px 10px;font-size:11px;border:1px solid var(--divider);background:var(--surface);border-radius:6px;cursor:pointer" onclick="event.stopPropagation();addChild(${n.id})">+ 子剧情</button></div>
    </div>
  </div>`;
}

function buildTags(n){
  const f=n.fields; const t=[];
  if(f.time) t.push(f.time);
  if(f.location) t.push(f.location);
  if(f.atmosphere) t.push(f.atmosphere);
  if(f.personality) t.push(f.personality);
  if(f.tension) t.push(f.tension);
  if(f.emotion) t.push(f.emotion);
  if(f.gap) t.push(f.gap);
  if(f.option_a) t.push(f.option_a.slice(0,6)+(f.option_a.length>6?'…':''));
  if(f.option_b) t.push(f.option_b.slice(0,6)+(f.option_b.length>6?'…':''));
  if(f.speaker&&f.listener) t.push(f.speaker+'→'+f.listener);
  // 也加用户自定义的extraTags
  if(f._tags) f._tags.forEach(x=>{if(!t.includes(x))t.push(x);});
  return t.slice(0,6);
}

function editTag(nodeId, oldTag){
  const n=mainline.find(x=>x.id===nodeId);
  if(!n) return;
  if(!n.fields._tags) n.fields._tags=[];
  const newTag = prompt('编辑标签（按回车确认，留空删除）:', oldTag);
  if(newTag===null) return;
  if(newTag===''){
    // 从fields和_tags中移除
    n.fields._tags = n.fields._tags.filter(t=>t!==oldTag);
    for(const k of Object.keys(n.fields)){
      if(n.fields[k]===oldTag) n.fields[k]='';
    }
  } else {
    // 替换 fields 中的匹配值
    for(const k of Object.keys(n.fields)){
      if(n.fields[k]===oldTag) n.fields[k]=newTag;
    }
    // 也在_tags中更新
    const idx = n.fields._tags.indexOf(oldTag);
    if(idx>=0) n.fields._tags[idx]=newTag;
    else if(!n.fields._tags.includes(newTag)) n.fields._tags.push(newTag);
  }
  renderMainline();
  saveProject();
}

function getSummary(n){
  const f=n.fields;
  if(n.type==='scene') return [f.time,f.location,f.atmosphere,f.purpose].filter(Boolean).join(' · ');
  if(n.type==='character') return [f.name,f.personality,f.motive].filter(Boolean).join(' · ');
  if(n.type==='event') return [f.cause,f.consequence].filter(Boolean).join(' → ');
  if(n.type==='dialogue') return [f.speaker,f.listener,(f.content&&f.content.slice(0,25)+(f.content.length>25?'…':''))].filter(Boolean).join(' · ');
  if(n.type==='choice') return [f.option_a,f.option_b].filter(Boolean).join(' / ');
  if(n.type==='mood') return [f.character,f.emotion].filter(Boolean).join(' · ');
  if(n.type==='transition') return f.gap||f.type||'';
  return '';
}
function color(t){ return {scene:'#2d3436',character:'#5856d6',event:'#e17055',dialogue:'#007aff',choice:'#ff9f0a',mood:'#34c759',transition:'#6c6c70'}[t]||'#6c6c70'; }

// ═══════════════════════════════════════════════
//  三级嵌套渲染（修复版）
// ═══════════════════════════════════════════════
function renderNest(children, parentId, level){
  if(!children||!children.length) return '';
  const lvl = level===2?'l2':'l3';
  return `<div class="nest-header">
    <span>${level===2?'子剧情':'细节'} · ${children.length} 个节点</span>
    <button onclick="event.stopPropagation();addChild(${parentId})">+ 添加</button>
  </div>
  <div class="nest-grid">
    ${children.map(c=>{
      const icon=c.icon||getTypeIcon(c.type);
      const title=c.fields.title||c.fields.name||c.label||getTypeLabel(c.type);
      const desc=getSummary(c);
      const hasC2=c.children2&&c.children2.length>0;
      return `<div class="nest-card" onclick="event.stopPropagation();selectNode('${level===2?'child':'child2'}',${parentId},${c.id})">
        <div class="nc-icon">${icon}<span class="nc-label" style="display:inline;margin-left:4px">${esc(title)}</span>${hasC2?`<span class="fb-badge">${c.children2.length}</span>`:''}</div>
        <div class="nc-desc">${esc(desc)}</div>
        <button class="nc-del" onclick="event.stopPropagation();delChild(${parentId},${c.id})">✕</button>
        ${level<3?`<div class="nest-level ${lvl}${hasC2?' show':''}" style="margin-top:6px;border-top:1px solid var(--divider);padding-top:6px">
          ${hasC2?renderNest(c.children2,c.id,3):''}
          <button style="font-size:10px;color:var(--blue);border:none;background:none;cursor:pointer;padding:2px 0" onclick="event.stopPropagation();addChild2(${parentId},${c.id})">+ 子节点</button>
        </div>`:''}
      </div>`;
    }).join('')}
  </div>`;
}

function toggleNest(id){
  const el=$('nest-'+id);
  if(el) el.classList.toggle('show');
}

// ═══════════════════════════════════════════════
//  子节点CRUD
// ═══════════════════════════════════════════════
function addChild(parentId){
  const p=mainline.find(n=>n.id===parentId); if(!p) return;
  if(!p.children) p.children=[];
  const fields={}; (TYPE_FIELDS.event||[]).forEach(f=>fields[f.id]=f.def||'');
  fields.title='新情节';
  p.children.push({id:uid(),type:'event',label:'新情节',icon:'📌',fields,children2:[]});
  renderMainline(); saveProject();
}
function addChild2(parentId,childId){
  const p=mainline.find(n=>n.id===parentId); if(!p) return;
  const c=(p.children||[]).find(x=>x.id===childId); if(!c) return;
  if(!c.children2) c.children2=[];
  const fields={}; (TYPE_FIELDS.event||[]).forEach(f=>fields[f.id]=f.def||'');
  fields.title='细节';
  c.children2.push({id:uid(),type:'event',label:'细节',icon:'🔍',fields});
  renderMainline(); saveProject();
}
function delChild(parentId,childId){
  if(!confirm('删除此节点？')) return;
  const p=mainline.find(n=>n.id===parentId); if(!p) return;
  p.children=(p.children||[]).filter(c=>c.id!==childId);
  if(sel&&sel.target!=='main'&&sel.id===childId) closeProp();
  renderMainline(); saveProject();
}

// ═══════════════════════════════════════════════
//  选中 + 属性面板
// ═══════════════════════════════════════════════
function selectNode(target,parentId,id){
  sel={target,parentId,id};
  renderMainline();
  // 找到节点
  let node=null;
  if(target==='main') node=mainline.find(n=>n.id===id);
  else if(target==='child'){
    const p=mainline.find(n=>n.id===parentId);
    if(p) node=(p.children||[]).find(c=>c.id===id);
  } else if(target==='child2'){
    const p=mainline.find(n=>n.id===parentId);
    if(p){
      for(const c of (p.children||[])){
        const c2=(c.children2||[]).find(x=>x.id===id);
        if(c2){node=c2;break;}
      }
    }
  }
  if(node) openPropPanel(node,target,parentId);
}

function openPropPanel(node,target,parentId){
  propOpen=true;
  $('propPanel').classList.add('open');
  $('propOverlay').classList.add('show');
  $('ppIcon').textContent=node.icon||getTypeIcon(node.type);
  $('ppTitle').textContent=getTypeLabel(node.type)+' · 属性';

  const fields=TYPE_FIELDS[node.type]||[];
  let html='';
  fields.forEach(f=>{
    const val=node.fields[f.id]||'';
    if(f.type==='area'){
      html+=`<div class="pp-group"><label>${f.label}</label><textarea onchange="updField('${target}',${parentId||'null'},${node.id},'${f.id}',this.value)" placeholder="${f.ph||''}">${esc(val)}</textarea></div>`;
    } else if(f.type==='pill'&&f.opts){
      html+=`<div class="pp-group"><label>${f.label}</label><div class="pp-pills">`;
      f.opts.forEach(o=>{html+=`<span class="pp-pill${o===val?' active':''}" onclick="updField('${target}',${parentId||'null'},${node.id},'${f.id}','${esc(o)}');this.parentElement.querySelectorAll('.pp-pill').forEach(p=>p.classList.remove('active'));this.classList.add('active')">${esc(o)}</span>`;});
      html+=`</div></div>`;
    } else {
      html+=`<div class="pp-group"><label>${f.label}</label><input type="text" value="${esc(val)}" onchange="updField('${target}',${parentId||'null'},${node.id},'${f.id}',this.value)"></div>`;
    }
  });

  // 额外信息
  html+=`<div class="pp-group" style="background:var(--surface2);padding:10px 12px;border-radius:var(--radius-sm);font-size:12px;color:var(--text2)">
    <div>类型：${getTypeLabel(node.type)} · ID：${node.id}</div>
    ${node.fields.purpose?`<div style="margin-top:4px">📌 ${esc(node.fields.purpose)}</div>`:''}
    ${node.fields.subtext?`<div style="margin-top:4px">💭 潜台词：${esc(node.fields.subtext)}</div>`:''}
    ${node.fields.stakes?`<div style="margin-top:4px">🎯 赌注：${esc(node.fields.stakes)}</div>`:''}
  </div>`;

  html+=`<div class="pp-delete" onclick="delNode('${target}',${parentId||'null'},${node.id})">删除此节点</div>`;
  $('ppBody').innerHTML=html;
}

function updField(target,parentId,id,fieldId,value){
  let node=null;
  if(target==='main') node=mainline.find(n=>n.id===id);
  else if(target==='child'){
    const p=mainline.find(n=>n.id===parentId);
    if(p) node=(p.children||[]).find(c=>c.id===id);
  } else if(target==='child2'){
    const p=mainline.find(n=>n.id===parentId);
    if(p){ for(const c of (p.children||[])){const c2=(c.children2||[]).find(x=>x.id===id);if(c2){node=c2;break;}}}
  }
  if(!node) return;
  node.fields[fieldId]=value;
  renderMainline(); saveProject();
}

function delNode(target,parentId,id){
  if(!confirm('删除？')) return;
  if(target==='main'){mainline=mainline.filter(n=>n.id!==id);}
  else if(target==='child'){
    const p=mainline.find(n=>n.id===parentId);
    if(p) p.children=(p.children||[]).filter(c=>c.id!==id);
  } else if(target==='child2'){
    const p=mainline.find(n=>n.id===parentId);
    if(p){for(const c of (p.children||[])){c.children2=(c.children2||[]).filter(x=>x.id!==id);}}
  }
  closeProp(); renderMainline(); saveProject();
}

function closeProp(){
  propOpen=false; $('propPanel').classList.remove('open'); $('propOverlay').classList.remove('show'); sel=null;
}

// ═══════════════════════════════════════════════
//  拖拽排序
// ═══════════════════════════════════════════════
function setupDragSort(){
  let el=null,idx=null;
  document.addEventListener('mousedown',e=>{
    const fb=e.target.closest('.fb-node'); if(!fb||e.target.closest('.nest-level')||e.target.closest('.fb-badge')||e.target.closest('.fb-tag')) return;
    el=fb; idx=parseInt(fb.dataset.index); dragSort={id:parseInt(fb.dataset.id),startY:e.clientY,moved:false};
    const mv=ev=>{if(!dragSort)return;const dy=ev.clientY-dragSort.startY;if(Math.abs(dy)>15)dragSort.moved=true;if(dragSort.moved)el.classList.add('dragging');};
    const up=ev=>{
      if(dragSort&&dragSort.moved){
        const nodes=document.querySelectorAll('.fb-node:not(.dragging)'); let ti=mainline.length-1;
        nodes.forEach((e,i)=>{const r=e.getBoundingClientRect();if(ev.clientY>r.top+r.height/2)ti=i;});
        const[m]=mainline.splice(idx,1); mainline.splice(ti,0,m); renderMainline(); saveProject();
      }
      if(el)el.classList.remove('dragging'); dragSort=null; el=null;
      document.removeEventListener('mousemove',mv); document.removeEventListener('mouseup',up);
    };
    document.addEventListener('mousemove',mv); document.addEventListener('mouseup',up);
  });
}

// ═══════════════════════════════════════════════
//  缩放
// ═══════════════════════════════════════════════
function zoomIn(){zoom=Math.min(2,zoom+.1);applyZoom();}
function zoomOut(){zoom=Math.max(.3,zoom-.1);applyZoom();}
function zoomReset(){zoom=1;applyZoom();}
function applyZoom(){$('canvasInner').style.transform=`scale(${zoom})`;$('zoomLabel').textContent=Math.round(zoom*100)+'%';}

// ═══════════════════════════════════════════════
//  保存/加载
// ═══════════════════════════════════════════════
function saveProject(){
  try{localStorage.setItem('storyfishbone3',JSON.stringify({mainline,nextId,genHistory,saved:new Date().toISOString()}));flashBtn('已保存');}
  catch(e){alert('保存失败');}
}
function loadProject(){
  try{
    const raw=localStorage.getItem('storyfishbone3'); if(!raw) return;
    const d=JSON.parse(raw); if(d.mainline&&d.mainline.length>0){mainline=d.mainline;nextId=d.nextId||1;genHistory=d.genHistory||[];}
  }catch(e){}
}
function flashBtn(msg){const b=document.querySelector('.sb-btn-save');if(!b)return;const o=b.textContent;b.textContent=msg;b.style.background='#34c759';b.style.color='#fff';setTimeout(()=>{b.textContent=o;b.style.background='';b.style.color='';},1200);}

// ═══════════════════════════════════════════════
//  生成历史
// ═══════════════════════════════════════════════
function showHistory(){
  if(!genHistory||!genHistory.length){alert('暂无生成记录');return;}
  // 临时用alert显示最近5条（后续可改进为弹窗）
  const txt = genHistory.slice(-5).reverse().map((h,i)=>`--- 第${genHistory.length-i}次 (${h.time}) ---\n${h.text.slice(0,300)}${h.text.length>300?'…':''}`).join('\n\n');
  // 用弹窗展示
  $('genBody').innerHTML = `<div style="white-space:pre-wrap;line-height:1.8">${esc(txt)}</div>`;
  $('genTitle').textContent = '生成历史 (最近5次)';
  $('genOverlay').classList.add('show');
  // 改回车继续看全篇
}

// ═══════════════════════════════════════════════
//  逻辑验证
// ═══════════════════════════════════════════════
function validateStory(){
  const issues=[];
  if(mainline.length<2) issues.push({t:'warn',m:'主线至少2个节点'});
  if(!mainline.some(n=>n.type==='scene')) issues.push({t:'warn',m:'缺少场景节点'});
  mainline.forEach(n=>{
    if(n.children&&n.children.length){
      n.children.forEach(c=>{
        const ok=Object.values(c.fields).some(v=>v&&v!==''&&v!=='无'&&v!=='?');
        if(!ok) issues.push({t:'warn',m:`"${n.fields.title||n.label||'?'}"的子节点缺少内容`});
      });
    }
  });
  const p=$('vpPanel'),b=$('vpBody');
  p.classList.add('show');
  b.innerHTML=issues.length?issues.map(r=>`<div class="vp-item"><div class="vp-dot ${r.t}"></div><div>${esc(r.m)}</div></div>`).join(''):'<div class="vp-empty">✅ 结构正常</div>';
}

// ═══════════════════════════════════════════════
//  生成故事（长文版）
// ═══════════════════════════════════════════════
function getApiKey(){
  let key = localStorage.getItem('storyfishbone_apikey');
  if(!key){
    key = prompt('请输入你的 DeepSeek API Key\n（可在 platform.deepseek.com/api_keys 获取）\n不输入则使用离线模式');
    if(key && key.trim()){
      key = key.trim();
      localStorage.setItem('storyfishbone_apikey', key);
    } else {
      return null;
    }
  }
  return key;
}

async function generateStory(){
  if(!mainline.length){alert('请先搭建故事');return;}
  const apiKey = getApiKey();
  if(!apiKey){ alert('请先设置 API Key'); return; }
  const ov=$('genOverlay'), bd=$('genBody');
  $('genTitle').textContent='故事生成';
  ov.classList.add('show');
  bd.innerHTML='<div class="gen-spinner"></div>生成中...（DeepSeek 正在创作）';

  const timeline=buildTimeline();
  const prompt = `你是一位专业小说家。根据以下故事蓝图，写出一段流畅的小说段落。

故事蓝图：
${timeline}

要求：
1. 严格按蓝图时间线推进，所有子剧情都要融入
2. 角色性格和行为一致，每个角色有鲜明的辨识度
3. 因果关系清晰，前因后果都要交代
4. 文笔要有场景感、画面感、对话要生动
5. 纯文本，不要markdown格式
6. 这是一个完整故事段落，不要收尾，断在精彩处
7. 字数不限，越长越好，尽情发挥`;

  try{
    const controller = new AbortController();
    const timeoutId = setTimeout(()=>controller.abort(), 60000); // 60s超时
    const resp=await fetch('https://api.deepseek.com/v1/chat/completions',{
      method:'POST',
      signal: controller.signal,
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+apiKey},
      body:JSON.stringify({
        model:'deepseek-v4-flash',
        messages:[{role:'system',content:'你是一位专业小说家，擅长根据故事蓝图创作长篇叙事。文笔流畅，画面感强，注重角色和因果。'},
                  {role:'user',content:prompt}],
        temperature:.85, max_tokens:2000
      })
    });
    clearTimeout(timeoutId);
    if(!resp.ok) throw new Error('API '+resp.status);
    const data=await resp.json();
    const text=data.choices?.[0]?.message?.content||'';
    bd.innerHTML=`<div style="white-space:pre-wrap;line-height:1.9">${esc(text)}</div>`;
    // 保存到历史
    genHistory.push({time:new Date().toLocaleString(), text, nodes:mainline.length});
    saveProject();
    // 顺手更新footer按钮显示历史
    updateHistoryBtn();
  } catch(e){
    bd.innerHTML=`<div style="color:var(--orange);margin-bottom:8px">⚠ API不可用，离线模式</div><div style="white-space:pre-wrap;line-height:1.9">${esc(localGen())}</div>`;
  }
}
function updateHistoryBtn(){
  const btn = document.querySelector('.sb-btn-validate');
  if(!btn) return;
  if(genHistory&&genHistory.length){
    btn.textContent = genHistory.length+'次✓';
    btn.title = '点击逻辑检查，双击看历史';
    btn.ondblclick = showHistory;
  }
}

function closeGen(){$('genOverlay').classList.remove('show');}
function copyGen(){
  const t=$('genBody').textContent;
  navigator.clipboard.writeText(t).then(()=>{
    const b=document.querySelector('.gm-copy'); b.textContent='✓ 已复制';
    setTimeout(()=>b.textContent='复制',1200);
  }).catch(()=>alert('复制失败'));
}

function buildTimeline(){
  return mainline.map((n,i)=>{
    const icon=n.icon||getTypeIcon(n.type);
    const title=n.fields.title||n.fields.name||n.label||getTypeLabel(n.type);
    const fs=Object.entries(n.fields).filter(([k,v])=>v&&!['icon','label','_tags'].includes(k)).map(([k,v])=>`${k}:${v}`).join(', ');
    let t=`【${i+1}】${icon} ${title} — ${fs}`;
    if(n.children&&n.children.length){
      t+='\n  ├ 子剧情:';
      n.children.forEach((c,j)=>{
        const ci=c.icon||getTypeIcon(c.type);
        const ct=c.fields.title||c.fields.name||c.label||getTypeLabel(c.type);
        const cf=Object.entries(c.fields).filter(([k,v])=>v&&!['icon','label','_tags'].includes(k)).map(([k,v])=>`${k}:${v}`).join(', ');
        t+=`\n  ├── ${j+1}. ${ci} ${ct} — ${cf}`;
        if(c.children2&&c.children2.length){
          c.children2.forEach((c2,k)=>{
            t+=`\n  ├──── ${j+1}.${k+1}. ${c2.fields.title||c2.fields.name||c2.label||'细节'}`;
          });
        }
      });
    }
    return t;
  }).join('\n\n');
}

function localGen(){
  return mainline.map(n=>{
    const icon=n.icon||getTypeIcon(n.type);
    const title=n.fields.title||n.fields.name||n.label||getTypeLabel(n.type);
    let t=`${icon} ${title}`;
    if(n.type==='scene') t+=`\n${n.fields.time||''}的${n.fields.location||'某处'}，${n.fields.atmosphere||''}。`;
    else if(n.type==='character') t+=`\n${n.fields.name||'某人'}（${n.fields.personality||'普通'}），${n.fields.motive||''}。`;
    else if(n.type==='event') t+=`\n${n.fields.description||'发生了某事'}。`;
    else if(n.type==='dialogue') t+=`\n${n.fields.speaker||'A'}："${n.fields.content||'...'}"`;
    else if(n.type==='choice') t+=`\n${n.fields.option_a||'A'} 或 ${n.fields.option_b||'B'}？`;
    if(n.children) n.children.forEach(c=>{t+=`\n  ${c.icon||'•'} ${c.fields.title||c.fields.name||c.label||''}`;});
    return t;
  }).join('\n---\n');
}

// 初始化历史按钮
setTimeout(updateHistoryBtn, 200);

// ═══════════════════════════════════════════════
//  蓝图编辑面板
// ═══════════════════════════════════════════════

// 灵感模板（供蓝图左侧列表使用）
const BP_TPL = [
  { icon:'💡', label:'关键线索', note:'推动剧情的信息' },
  { icon:'🔍', label:'发现真相', note:'角色发现隐藏的事实' },
  { icon:'⚡', label:'冲突爆发', note:'矛盾激化的时刻' },
  { icon:'💬', label:'关键对话', note:'决定性的对话场景' },
  { icon:'🤝', label:'联盟形成', note:'角色之间建立同盟' },
  { icon:'🔄', label:'剧情反转', note:'出乎意料的转折' },
  { icon:'🎯', label:'目标达成', note:'角色实现了阶段性目标' },
  { icon:'😢', label:'情感高潮', note:'情感上的重大冲击点' },
  { icon:'🌑', label:'低谷时刻', note:'角色陷入最低潮' },
  { icon:'🚪', label:'新入口点', note:'开启新的剧情分支' },
  { icon:'💀', label:'危机降临', note:'重大危险或死亡事件' },
  { icon:'🔐', label:'谜底揭晓', note:'隐藏的秘密被揭开' },
];

// ─── 打开蓝图面板 ───
function openBlueprint(nodeId){
  // 双击打开蓝图时先关掉属性面板，避免遮挡
  if(propOpen) closeProp();
  const node = mainline.find(n=>n.id===nodeId);
  if(!node) return;
  bpActiveNode = node;
  bpLinkMode = false;
  bpLinkFrom = null;
  bpSelLink = null;

  // 初始化或加载蓝图数据
  if(!node.blueprints){
    node.blueprints = { nodes:[], links:[] };
  }
  bpNodes = node.blueprints.nodes || [];
  bpLinks = node.blueprints.links || [];
  // 确定最大id
  bpNextId = 1;
  bpNodes.forEach(n=>{ if(n.id >= bpNextId) bpNextId = n.id + 1; });

  // 更新标题
  const title = node.fields.title||node.fields.name||node.label||getTypeLabel(node.type);
  $('bpNodeName').textContent = esc(title);
  $('bpTitle').textContent = '🔗 蓝图编辑 · '+esc(title);
  $('bpStatus').textContent = bpNodes.length+' 节点 · '+bpLinks.length+' 连线';

  // 渲染左侧模板
  renderBpTplList();
  // 渲染蓝图画布
  bpRenderCanvas();
  // 显示面板
  $('bpOverlay').classList.add('show');
}

// ─── 关闭蓝图面板 ───
function closeBlueprint(){
  $('bpOverlay').classList.remove('show');
  bpActiveNode = null;
  bpNodes = [];
  bpLinks = [];
  bpLinkMode = false;
  bpLinkFrom = null;
  bpSelLink = null;
  bpDragNode = null;
}

// ─── 渲染左侧模板列表 ───
function renderBpTplList(){
  const list = $('bpTplList');
  list.innerHTML = BP_TPL.map((t,i)=>`
    <div class="bp-node-tpl" draggable="true"
         ondragstart="bpOnTplDragStart(event,${i})">
      <span>${t.icon}</span>
      <span>${esc(t.label)}</span>
    </div>
  `).join('');
}

let bpDraggingTplIdx = -1;
function bpOnTplDragStart(e, idx){
  bpDraggingTplIdx = idx;
  e.dataTransfer.setData('text/plain', 'bp_tpl_'+idx);
  e.dataTransfer.effectAllowed = 'copy';
}

// ─── 渲染蓝图画布（节点 + SVG连线） ───
function bpRenderCanvas(){
  const container = $('bpCanvasNodes');
  // 先清空，但保留svg
  container.innerHTML = '';

  // 渲染每个蓝图节点
  bpNodes.forEach(n => {
    const el = document.createElement('div');
    el.className = 'bp-node';
    el.dataset.id = n.id;
    el.style.left = n.x+'px';
    el.style.top = n.y+'px';
    el.innerHTML = `
      <div class="bpn-top">
        <span class="bpn-icon" style="background:${n.color||'var(--blue)'}20;color:${n.color||'var(--blue)'}">${n.icon||'📌'}</span>
        <span class="bpn-label">${esc(n.label||'节点')}</span>
      </div>
      ${n.note?`<div class="bpn-note">${esc(n.note)}</div>`:''}
      <button class="bpn-del" onclick="event.stopPropagation();bpDelNode(${n.id})">✕</button>
      <div class="bpn-handle bpn-handle-r" data-side="r" onmousedown="event.stopPropagation();bpStartLink(${n.id},'r')"></div>
      <div class="bpn-handle bpn-handle-l" data-side="l" onmousedown="event.stopPropagation();bpStartLink(${n.id},'l')"></div>
      <div class="bpn-handle bpn-handle-t" data-side="t" onmousedown="event.stopPropagation();bpStartLink(${n.id},'t')"></div>
      <div class="bpn-handle bpn-handle-b" data-side="b" onmousedown="event.stopPropagation();bpStartLink(${n.id},'b')"></div>
    `;
    // 点击选中
    el.addEventListener('click', (e)=>{
      e.stopPropagation();
      bpSelectNode(n.id);
    });
    // 拖拽移动
    el.addEventListener('mousedown', (e)=>{
      if(e.target.closest('.bpn-del')||e.target.closest('.bpn-handle')) return;
      bpDragNode = n.id;
      const rect = el.getBoundingClientRect();
      const dx = e.clientX - rect.left;
      const dy = e.clientY - rect.top;
      const move = (ev)=>{
        if(bpDragNode === null) return;
        const cn = bpNodes.find(x=>x.id===bpDragNode);
        if(!cn) return;
        const parentRect = $('bpRight').getBoundingClientRect();
        cn.x = Math.max(0, ev.clientX - parentRect.left - dx);
        cn.y = Math.max(0, ev.clientY - parentRect.top - dy);
        const cel = container.querySelector(`.bp-node[data-id="${cn.id}"]`);
        if(cel){ cel.style.left = cn.x+'px'; cel.style.top = cn.y+'px'; }
        bpRenderLinks();
      };
      const up = ()=>{
        bpDragNode = null;
        document.removeEventListener('mousemove', move);
        document.removeEventListener('mouseup', up);
      };
      document.addEventListener('mousemove', move);
      document.addEventListener('mouseup', up);
    });
    container.appendChild(el);
  });

  // 渲染连线
  bpRenderLinks();
  // 更新状态
  $('bpStatus').textContent = bpNodes.length+' 节点 · '+bpLinks.length+' 连线';
}

// ─── 渲染SVG连线 ───
function bpRenderLinks(){
  const svg = $('bpSvg');
  // 清除旧连线（保留 defs）
  const defs = svg.querySelector('defs');
  svg.innerHTML = '';
  if(defs) svg.appendChild(defs);

  // 如果没有连线
  if(!bpLinks.length) return;

  // 获取每个节点的中心位置
  function getHandlePos(n, side){
    if(!n) return {x:0,y:0};
    const w = 120, h = 60; // 估算节点尺寸
    const cx = n.x + w/2;
    const cy = n.y + h/2;
    switch(side){
      case 'r': return {x: n.x + w, y: cy};
      case 'l': return {x: n.x, y: cy};
      case 't': return {x: cx, y: n.y};
      case 'b': return {x: cx, y: n.y + h};
      default: return {x: cx, y: cy};
    }
  }

  bpLinks.forEach((link, idx) => {
    const fromNode = bpNodes.find(n=>n.id===link.fromId);
    const toNode = bpNodes.find(n=>n.id===link.toId);
    if(!fromNode||!toNode) return;

    const from = getHandlePos(fromNode, link.fromSide);
    const to = getHandlePos(toNode, link.toSide);

    // 曲线路径（贝塞尔）
    const dx = to.x - from.x;
    const cp1x = from.x + dx * 0.4;
    const cp2x = to.x - dx * 0.4;
    const d = `M ${from.x} ${from.y} C ${cp1x} ${from.y}, ${cp2x} ${to.y}, ${to.x} ${to.y}`;

    let cls = 'bp-link-causal';
    let label = '因果';
    if(link.type==='hint'){ cls = 'bp-link-hint'; label = '暗示'; }
    else if(link.type==='trigger'){ cls = 'bp-link-trigger'; label = '触发'; }

    const selClass = (bpSelLink===idx)?' selected':'';

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', d);
    path.setAttribute('class', cls+selClass);
    path.setAttribute('data-idx', idx);
    path.style.pointerEvents = 'stroke';
    path.style.cursor = 'pointer';
    path.style.strokeWidth = bpSelLink===idx ? '4' : '2';
    // 点击选中连线
    path.addEventListener('click', (e)=>{
      e.stopPropagation();
      bpSelLink = idx;
      bpRenderLinks();
      bpUpdateLinkBtn();
    });
    svg.appendChild(path);

    // 标签（中点偏上）
    const mx = (from.x + to.x) / 2;
    const my = (from.y + to.y) / 2 - 8;
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', mx);
    text.setAttribute('y', my);
    text.setAttribute('class', 'bp-link-label');
    text.setAttribute('text-anchor', 'middle');
    text.textContent = label;
    text.style.pointerEvents = 'none';
    svg.appendChild(text);
  });
}

// ─── 选中蓝图节点 ───
function bpSelectNode(id){
  document.querySelectorAll('.bp-node').forEach(el=>el.classList.remove('selected'));
  const el = document.querySelector(`.bp-node[data-id="${id}"]`);
  if(el) el.classList.add('selected');
  // 取消连线选中
  bpSelLink = null;
  bpRenderLinks();
  bpUpdateLinkBtn();
}

// ─── 取消所有选中 ───
function bpDeselectAll(){
  document.querySelectorAll('.bp-node').forEach(el=>el.classList.remove('selected'));
  bpSelLink = null;
  bpRenderLinks();
  bpUpdateLinkBtn();
}

// ─── 从模板添加蓝图节点 ───
function bpAddNode(tplIdx){
  const tpl = BP_TPL[tplIdx];
  if(!tpl) return;
  const id = bpNextId++;
  // 随机位置
  const x = 40 + Math.random() * 200;
  const y = 40 + Math.random() * 150;
  const node = {
    id,
    icon: tpl.icon,
    label: tpl.label,
    note: tpl.note||'',
    x, y,
    color: '#007aff'
  };
  bpNodes.push(node);
  bpRenderCanvas();
  bpSaveBlueprint();
}

// ─── 删除蓝图节点 ───
function bpDelNode(id){
  if(!confirm('删除此蓝图节点？')) return;
  bpNodes = bpNodes.filter(n=>n.id!==id);
  bpLinks = bpLinks.filter(l=>l.fromId!==id&&l.toId!==id);
  bpSelLink = null;
  bpRenderCanvas();
  bpSaveBlueprint();
}

// ─── 开始连线 ───
function bpStartLink(fromId, side){
  if(!bpLinkMode){
    // 非连线模式：提示开启连线模式
    $('bpStatus').textContent = '请先点击「连线」按钮进入连线模式';
    setTimeout(()=>{
      $('bpStatus').textContent = bpNodes.length+' 节点 · '+bpLinks.length+' 连线';
    }, 1500);
    return;
  }
  bpLinkFrom = {nodeId: fromId, side};
  // 高亮起点
  document.querySelectorAll('.bp-node').forEach(el=>el.classList.remove('selected'));
  const el = document.querySelector(`.bp-node[data-id="${fromId}"]`);
  if(el) el.classList.add('selected');
  $('bpStatus').textContent = '连线: 点击目标节点完成连线 (Esc取消)';
}

// ─── 完成连线（由节点点击触发） ───
function bpEndLink(toId){
  if(!bpLinkFrom||bpLinkFrom.nodeId===toId) return;
  // 弹出选择连线类型
  const type = prompt('选择连线类型:\n1. 因果 (causal)\n2. 暗示 (hint)\n3. 触发 (trigger)\n\n输入数字或直接回车默认因果:');
  let linkType = 'causal';
  if(type==='2') linkType = 'hint';
  else if(type==='3') linkType = 'trigger';

  // 检查是否已存在同样连线
  const exists = bpLinks.some(l=>l.fromId===bpLinkFrom.nodeId&&l.toId===toId);
  if(!exists){
    bpLinks.push({
      fromId: bpLinkFrom.nodeId,
      fromSide: bpLinkFrom.side,
      toId: toId,
      toSide: 'l', // 默认连到左侧
      type: linkType
    });
    bpRenderLinks();
    bpSaveBlueprint();
    $('bpStatus').textContent = '连线已添加';
    setTimeout(()=>{
      $('bpStatus').textContent = bpNodes.length+' 节点 · '+bpLinks.length+' 连线';
    }, 800);
  } else {
    $('bpStatus').textContent = '连线已存在';
  }
  // 取消连线模式
  bpLinkFrom = null;
  document.querySelectorAll('.bp-node').forEach(el=>el.classList.remove('selected'));
}

// ─── 切换连线模式 ───
function bpToggleLinkMode(){
  bpLinkMode = !bpLinkMode;
  bpLinkFrom = null;
  const btn = $('bpLinkBtn');
  if(bpLinkMode){
    btn.textContent = '✏ 连线中 (点击取消)';
    btn.style.background = 'var(--orange)';
    $('bpStatus').textContent = '连线模式: 拖动节点上的圆点手柄到另一个节点';
  } else {
    btn.textContent = '✏ 连线';
    btn.style.background = '';
    $('bpStatus').textContent = bpNodes.length+' 节点 · '+bpLinks.length+' 连线';
    document.querySelectorAll('.bp-node').forEach(el=>el.classList.remove('selected'));
  }
  bpSelLink = null;
  bpRenderLinks();
}

// ─── 更新连线按钮状态 ───
function bpUpdateLinkBtn(){
  const btn = $('bpLinkBtn');
  if(bpLinkMode){
    btn.textContent = '✏ 连线中 (点击取消)';
    btn.style.background = 'var(--orange)';
  } else {
    btn.textContent = '✏ 连线';
    btn.style.background = '';
  }
}

// ─── 删除选中的连线 ───
function bpDeleteSelectedLink(){
  if(bpSelLink===null||bpSelLink===undefined) return;
  if(!confirm('删除此连线？')) return;
  bpLinks.splice(bpSelLink, 1);
  bpSelLink = null;
  bpRenderLinks();
  bpSaveBlueprint();
}

// ─── 保存蓝图数据到鱼骨节点 ───
function bpSaveBlueprint(){
  if(!bpActiveNode) return;
  bpActiveNode.blueprints = {
    nodes: JSON.parse(JSON.stringify(bpNodes)),
    links: JSON.parse(JSON.stringify(bpLinks))
  };
  saveProject();
  // 更新鱼骨图标
  renderMainline();
}

// ─── 保存并关闭 ───
function bpSaveAndClose(){
  bpSaveBlueprint();
  closeBlueprint();
}

// ─── 蓝图画布拖放：从左侧模板添加节点 ───
document.addEventListener('DOMContentLoaded', ()=>{
  const right = $('bpRight');
  if(!right) return;
  right.addEventListener('dragover', e=>{ e.preventDefault(); });
  right.addEventListener('drop', e=>{
    e.preventDefault();
    const data = e.dataTransfer.getData('text/plain');
    if(!data||!data.startsWith('bp_tpl_')) return;
    const idx = parseInt(data.replace('bp_tpl_',''));
    if(isNaN(idx)||idx<0||idx>=BP_TPL.length) return;
    // 计算放置位置
    const rect = right.getBoundingClientRect();
    const x = e.clientX - rect.left - 60;
    const y = e.clientY - rect.top - 30;
    const id = bpNextId++;
    const tpl = BP_TPL[idx];
    bpNodes.push({
      id, icon: tpl.icon, label: tpl.label, note: tpl.note||'',
      x: Math.max(0,x), y: Math.max(0,y),
      color: '#007aff'
    });
    bpRenderCanvas();
    bpSaveBlueprint();
  });
});

// ─── 键盘快捷键（蓝图模式下） ───
document.addEventListener('keydown', (e)=>{
  if(!bpActiveNode) return; // 只在蓝图面板打开时
  if(e.key==='Escape'){
    if(bpLinkFrom){
      // 取消当前连线
      bpLinkFrom = null;
      document.querySelectorAll('.bp-node').forEach(el=>el.classList.remove('selected'));
      $('bpStatus').textContent = '连线已取消';
      setTimeout(()=>{
        $('bpStatus').textContent = bpNodes.length+' 节点 · '+bpLinks.length+' 连线';
      }, 800);
    } else if(bpLinkMode){
      bpToggleLinkMode();
    } else {
      // 按两次Escape关闭面板？只做第一次取消选中
      if(!bpSelLink) closeBlueprint();
      else { bpSelLink = null; bpRenderLinks(); }
    }
    return;
  }
  // Delete/Backspace 删除选中的连线
  if((e.key==='Delete'||e.key==='Backspace')&&bpSelLink!==null){
    e.preventDefault();
    bpDeleteSelectedLink();
  }
});
