"use strict";

// ─── 状态 ───
let mainline = [];
let nextId = 1;
let sel = null;        // {target, parentId, id}
let zoom = 1;
let genHistory = [];   // [{time, text, nodes}]
let propOpen = false;
let dragSort = null;

const $ = id=>document.getElementById(id);
const esc = s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const uid = ()=>nextId++;

document.addEventListener('DOMContentLoaded',()=>{
  loadProject();
  renderGroups();
  renderMainline();
  setupDrop();
  setupDragSort();
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
  return `<div class="fb-node${selClass}" data-id="${n.id}" data-index="${i}"
       onclick="selectNode('main',null,${n.id})"
       ondblclick="toggleNest(${n.id})">
    <div class="fb-order">${i+1}</div>
    <div class="fb-top">
      <span class="fb-icon" style="background:${color(n.type)}20;color:${color(n.type)}">${icon}</span>
      <span class="fb-title">${esc(title)}</span>
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
async function generateStory(){
  if(!mainline.length){alert('请先搭建故事');return;}
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
      headers:{'Content-Type':'application/json','Authorization':'Bearer sk-b099309822cf44dfaa1ef01ccc153dd5'},
      body:JSON.stringify({
        model:'deepseek-chat',
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
