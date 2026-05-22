"use strict";

/* ============================================================
   故事鱼骨 叙事引擎 v3 — 交互逻辑
   iOS风格 · 呼吸动效 · 拖拽排序 · 缩放平移 · 三级嵌套
   ============================================================ */

// ─── 状态 ───
let mainline = [];       // [{id, type, label, fields, children, children2}]
let nextId = 1;
let sel = null;          // {target:'main'|'child'|'child2', parentId, id}
let zoom = 1;
let dragSort = null;     // {id, startY}
let propOpen = false;

// ─── 工具 ───
const $ = id => document.getElementById(id);
function esc(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function uid(){ return nextId++; }

// ─── 初始化 ───
document.addEventListener('DOMContentLoaded', ()=>{
  loadProject();
  renderGroups();
  renderMainline();
  setupDrop();
  setupDragSort();
});
window.addEventListener('resize', ()=>{});

// ==============================================================
//  预制模板列表（分组折叠）
// ==============================================================
function renderGroups(){
  const q = ($('tplSearch').value||'').toLowerCase();
  const container = $('sbGroups');
  container.innerHTML = TPL_GROUPS.map((g,gi) => {
    const items = g.items.filter(it => !q || it.label.includes(q) || g.name.includes(q));
    if(items.length===0 && q) return '';
    return `<div class="tpl-group">
      <div class="tpl-group-header" onclick="toggleGroup(${gi})">
        <span class="gg-icon">${g.icon}</span>
        <span class="gg-name">${g.name} · ${g.items.length}</span>
        <span class="gg-arrow">▼</span>
      </div>
      <div class="tpl-group-body" id="gb${gi}">
        ${items.map(it => `
          <div class="tpl-item anim-fade" draggable="true"
               data-type="${g.name}" data-label="${esc(it.label)}"
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
  const body = $('gb'+i);
  const header = body.previousElementSibling;
  if(!body||!header) return;
  body.classList.toggle('hide');
  header.classList.toggle('collapsed');
}

// ─── 拖放 ───
let dragLabel = '';
function onDragStart(e, label){
  dragLabel = label;
  e.dataTransfer.setData('text/plain', label);
  e.dataTransfer.effectAllowed = 'copy';
  // 拖拽幽灵
  const ghost = document.createElement('div');
  ghost.className = 'drag-ghost'; ghost.textContent = label;
  document.body.appendChild(ghost);
  e.dataTransfer.setDragImage(ghost, 30, 15);
  setTimeout(()=>ghost.remove(), 0);
}

function setupDrop(){
let dropGuard = false;
  const processedDrops = new WeakSet();
  const targets = [document.getElementById('fishboneContainer'), document.getElementById('canvasInner')];
  function handleDrop(e){
    e.preventDefault();
    if(processedDrops.has(e)) return;
    processedDrops.add(e);
    const label = e.dataTransfer.getData('text/plain') || dragLabel;
    if(!label) return;
    // 查找匹配的模板
    for(const g of TPL_GROUPS) for(const it of g.items){
      if(it.label === label){
        const fields = getDefaultFieldsForTemplate(it);
        const node = { id: uid(), type: getTypeFromTemplate(it), label: it.label, icon: it.icon, fields, children: [] };
        mainline.push(node);
        renderMainline();
        selectNode('main', null, node.id);
        saveProject();
        return;
      }
    }
  }
  targets.forEach(el => {
    if(el){
      el.addEventListener('dragover', e=>e.preventDefault());
      el.addEventListener('drop', function(e){
        e.stopPropagation(); // 防止事件冒泡到父级导致重复触发
        handleDrop(e);
      });
    }
  });
}

function getTypeFromTemplate(it){
  for(const [type, fields] of Object.entries(TYPE_FIELDS)){
    const fnames = Object.keys(fields);
    const match = Object.keys(it.fields).some(k => fnames.includes(k));
    if(match) return type;
  }
  return 'event';
}
function getDefaultFieldsForTemplate(it){
  return JSON.parse(JSON.stringify(it.fields));
}

// ==============================================================
//  鱼骨图渲染
// ==============================================================
function renderMainline(){
  const container = $('fishboneContainer');
  if(mainline.length === 0){
    container.innerHTML = '<div class="fb-empty">从左侧拖拽模板到此处 · 搭建你的故事</div>';
    return;
  }
  container.innerHTML = '<div class="fishbone">' +
    mainline.map((n,i) => renderFBNode(n, i)).join('') +
    '</div>';
}

function renderFBNode(n, i){
  const icon = n.icon || getTypeIcon(n.type);
  const title = n.fields.title || n.fields.name || n.label || getTypeLabel(n.type);
  const desc = getNodeSummary(n);
  const selClass = (sel?.target==='main' && sel?.id===n.id) ? ' selected' : '';
  const tags = [];
  if(n.fields.time) tags.push(n.fields.time);
  if(n.fields.location) tags.push(n.fields.location);
  if(n.fields.atmosphere) tags.push(n.fields.atmosphere);
  if(n.fields.personality) tags.push(n.fields.personality);
  if(n.fields.tension) tags.push(n.fields.tension);
  if(n.fields.emotion) tags.push(n.fields.emotion);
  if(n.fields.gap) tags.push(n.fields.gap);
  const hasChildren = n.children && n.children.length > 0;
  return `<div class="fb-node${selClass}" data-id="${n.id}" data-index="${i}"
       onclick="selectNode('main',null,${n.id})"
       ondblclick="toggleNest(${n.id})">
    <div class="fb-order">${i+1}</div>
    <div class="fb-top">
      <span class="fb-icon" style="background:${getTypeColor(n.type)}20;color:${getTypeColor(n.type)}">${icon}</span>
      <span class="fb-title">${esc(title)}</span>
      ${hasChildren ? `<span class="fb-badge">${n.children.length}</span>` : ''}
    </div>
    <div class="fb-desc">${esc(desc)}</div>
    ${tags.length>0 ? '<div class="fb-tags">'+tags.map(t=>`<span class="fb-tag">${esc(t)}</span>`).join('')+'</div>' : ''}
    <div class="nest-level${hasChildren?' show':''} l1" id="nest-${n.id}">
      ${hasChildren ? renderNestLevel(n.children, n.id, 2) : ''}
      <div style="margin-top:6px"><button class="sb-btn-save" style="padding:3px 10px;font-size:11px;border:1px solid var(--divider);background:var(--surface);border-radius:6px;cursor:pointer" onclick="event.stopPropagation();addChild(${n.id})">+ 子剧情</button></div>
    </div>
  </div>`;
}

function getNodeSummary(n){
  const f = n.fields;
  if(n.type==='scene') return [f.time, f.location, f.atmosphere].filter(Boolean).join(' · ');
  if(n.type==='character') return [f.name, f.personality, f.motive].filter(Boolean).join(' · ');
  if(n.type==='event') return [f.cause, f.consequence].filter(Boolean).join(' → ');
  if(n.type==='dialogue') return [f.speaker, f.listener, f.content&&f.content.slice(0,20)+(f.content.length>20?'...':'')].filter(Boolean).join(' · ');
  if(n.type==='choice') return [f.option_a, f.option_b].filter(Boolean).join(' / ');
  if(n.type==='mood') return [f.character, f.emotion].filter(Boolean).join(' · ');
  if(n.type==='transition') return f.gap||f.type||'';
  return '';
}
function getTypeColor(t){ return {scene:'#2d3436',character:'#5856d6',event:'#e17055',dialogue:'#007aff',choice:'#ff9f0a',mood:'#34c759',transition:'#6c6c70'}[t]||'#6c6c70'; }

// ─── 三级嵌套渲染 ───
function renderNestLevel(children, parentId, level){
  if(!children || children.length===0) return '';
  return `<div class="nest-header">
    <span>子剧情 · ${children.length} 个节点</span>
    <button onclick="event.stopPropagation();addChild(${parentId})">+ 添加</button>
  </div>
  <div class="nest-grid">
    ${children.map(c => {
      const icon = c.icon || getTypeIcon(c.type);
      const title = c.fields.title || c.fields.name || c.label || getTypeLabel(c.type);
      const desc = getNodeSummary(c);
      const hasC2 = c.children2 && c.children2.length > 0;
      return `<div class="nest-card" onclick="event.stopPropagation();selectNode('child',${parentId},${c.id})">
        <div class="nc-icon">${icon}</div>
        <div class="nc-label">${esc(title)}${hasC2?' <span class="fb-badge">'+c.children2.length+'</span>':''}</div>
        <div class="nc-desc">${esc(desc)}</div>
        <button class="nc-del" onclick="event.stopPropagation();delChild(${parentId},${c.id})">✕</button>
        ${level < 3 ? `<div class="nest-level l${level}${hasC2?' show':''}" id="nest2-${c.id}" style="margin-top:4px;padding-top:4px;border-top:1px solid var(--divider)">
          ${hasC2 ? renderNestLevel(c.children2, c.id, 3) : ''}
          <button style="font-size:10px;color:var(--blue);border:none;background:none;cursor:pointer;padding:2px 0" onclick="event.stopPropagation();addChild2(${parentId},${c.id})">+ 子节点</button>
        </div>` : ''}
      </div>`;
    }).join('')}
  </div>`;
}

// ─── 子节点操作 ───
function addChild(parentId){
  const p = mainline.find(n=>n.id===parentId);
  if(!p) return;
  if(!p.children) p.children = [];
  const fields = getDefaultFields('event', '__custom__');
  fields.title = '新情节';
  p.children.push({ id:uid(), type:'event', label:'新情节', icon:'📌', fields, children2:[] });
  renderMainline();
  saveProject();
}
function addChild2(parentId, childId){
  const p = mainline.find(n=>n.id===parentId);
  if(!p) return;
  const c = (p.children||[]).find(x=>x.id===childId);
  if(!c) return;
  if(!c.children2) c.children2 = [];
  c.children2.push({ id:uid(), type:'event', label:'细节', icon:'🔍', fields: getDefaultFields('event','__custom__'), children2:[] });
  renderMainline();
  saveProject();
}
function delChild(parentId, childId){
  if(!confirm('删除此子节点？')) return;
  const p = mainline.find(n=>n.id===parentId);
  if(!p) return;
  p.children = (p.children||[]).filter(c=>c.id!==childId);
  if(sel?.target==='child' && sel?.id===childId) closeProp();
  renderMainline();
  saveProject();
}

// ─── 嵌套展开/折叠 ───
function toggleNest(id){
  const el = $('nest-'+id);
  if(!el) return;
  el.classList.toggle('show');
}

// ─── 选中节点 ───
function selectNode(target, parentId, id){
  sel = {target, parentId, id};
  renderMainline();
  // 打开属性面板
  let node = null;
  if(target==='main') node = mainline.find(n=>n.id===id);
  else if(target==='child'){
    const p = mainline.find(n=>n.id===parentId);
    if(p) node = (p.children||[]).find(c=>c.id===id);
  }
  if(node) openPropPanel(node, target, parentId);
}

// ==============================================================
//  拖拽排序（鱼骨图节点）
// ==============================================================
function setupDragSort(){
  let dragEl=null, dragId=null, dragIndex=null;
  document.addEventListener('mousedown', e => {
    const fb = e.target.closest('.fb-node');
    if(!fb || e.target.closest('.nest-level') || e.target.closest('.fb-badge')) return;
    dragEl = fb;
    dragId = parseInt(fb.dataset.id);
    dragIndex = parseInt(fb.dataset.index);
    dragSort = {id:dragId, startY:e.clientY, moved:false};
    const onMove = ev => {
      if(!dragSort) return;
      const dy = ev.clientY - dragSort.startY;
      if(Math.abs(dy) > 15) dragSort.moved = true;
      if(dragSort.moved) dragEl.classList.add('dragging');
    };
    const onUp = ev => {
      if(dragSort && dragSort.moved){
        // 计算目标位置
        const nodes = document.querySelectorAll('.fb-node:not(.dragging)');
        let targetIndex = mainline.length - 1;
        nodes.forEach((el, i) => {
          const rect = el.getBoundingClientRect();
          if(ev.clientY > rect.top + rect.height/2) targetIndex = i;
        });
        // 执行排序
        const [moved] = mainline.splice(dragIndex, 1);
        mainline.splice(targetIndex, 0, moved);
        renderMainline();
        saveProject();
      }
      if(dragEl) dragEl.classList.remove('dragging');
      dragSort = null; dragEl = null;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });
}

// ==============================================================
//  缩放平移
// ==============================================================
function zoomIn(){ zoom = Math.min(2, zoom + 0.1); applyZoom(); }
function zoomOut(){ zoom = Math.max(0.3, zoom - 0.1); applyZoom(); }
function zoomReset(){ zoom = 1; applyZoom(); }
function applyZoom(){
  $('canvasInner').style.transform = `scale(${zoom})`;
  $('zoomLabel').textContent = Math.round(zoom*100) + '%';
}

// ==============================================================
//  属性面板（iOS风格）
// ==============================================================
function openPropPanel(node, target, parentId){
  propOpen = true;
  $('propPanel').classList.add('open');
  $('propOverlay').classList.add('show');
  const icon = node.icon || getTypeIcon(node.type);
  const label = getTypeLabel(node.type);
  $('ppIcon').textContent = icon;
  $('ppTitle').textContent = label + ' · 属性';

  const fields = TYPE_FIELDS[node.type] || [];
  let html = '';
  fields.forEach(f => {
    const val = node.fields[f.id] || '';
    if(f.type === 'area'){
      html += `<div class="pp-group"><label>${f.label}</label><textarea
        onchange="updateField('${target}',${parentId||'null'},${node.id},'${f.id}',this.value)"
        placeholder="${f.ph||''}">${esc(val)}</textarea></div>`;
    } else if(f.type === 'pill' && f.opts){
      html += `<div class="pp-group"><label>${f.label}</label><div class="pp-pills">`;
      f.opts.forEach(o => {
        html += `<span class="pp-pill${o===val?' active':''}"
          onclick="updateField('${target}',${parentId||'null'},${node.id},'${f.id}','${esc(o)}');this.parentElement.querySelectorAll('.pp-pill').forEach(p=>p.classList.remove('active'));this.classList.add('active')">${esc(o)}</span>`;
      });
      html += `</div></div>`;
    } else {
      html += `<div class="pp-group"><label>${f.label}</label><input type="text" value="${esc(val)}"
        onchange="updateField('${target}',${parentId||'null'},${node.id},'${f.id}',this.value)"></div>`;
    }
  });

  // 额外信息块
  html += `<div class="pp-group" style="background:var(--surface2);padding:10px 12px;border-radius:var(--radius-sm);font-size:12px;color:var(--text2)">
    <div>类型：${label}</div>
    <div>ID：${node.id}</div>
    ${node.fields.purpose ? `<div style="margin-top:4px">📌 ${esc(node.fields.purpose)}</div>` : ''}
  </div>`;

  html += `<div class="pp-delete" onclick="deleteCurrentNode('${target}',${parentId||'null'},${node.id})">删除此节点</div>`;
  $('ppBody').innerHTML = html;
}

function updateField(target, parentId, id, fieldId, value){
  let node = null;
  if(target==='main') node = mainline.find(n=>n.id===id);
  else if(target==='child'){
    const p = mainline.find(n=>n.id===parentId);
    if(p) node = (p.children||[]).find(c=>c.id===id);
  }
  if(!node) return;
  node.fields[fieldId] = value;
  renderMainline();
  saveProject();
}

function deleteCurrentNode(target, parentId, id){
  if(!confirm('删除此节点？')) return;
  if(target==='main'){
    mainline = mainline.filter(n=>n.id!==id);
  } else if(target==='child'){
    const p = mainline.find(n=>n.id===parentId);
    if(p) p.children = (p.children||[]).filter(c=>c.id!==id);
  }
  closeProp();
  renderMainline();
  saveProject();
}

function closeProp(){
  propOpen = false;
  $('propPanel').classList.remove('open');
  $('propOverlay').classList.remove('show');
  sel = null;
}

// ==============================================================
//  保存/加载
// ==============================================================
function saveProject(){
  try{
    const data = {mainline, nextId, saved: new Date().toISOString()};
    localStorage.setItem('storyfishbone3', JSON.stringify(data));
    flashBtn('已保存');
  }catch(e){ alert('保存失败'); }
}
function loadProject(){
  try{
    const raw = localStorage.getItem('storyfishbone3');
    if(!raw) return;
    const data = JSON.parse(raw);
    if(data.mainline && data.mainline.length>0){
      mainline = data.mainline; nextId = data.nextId || 1;
    }
  }catch(e){}
}
function flashBtn(msg){
  const btn = document.querySelector('.sb-btn-save');
  if(!btn) return;
  const orig = btn.textContent;
  btn.textContent = msg; btn.style.background = '#34c759'; btn.style.color = '#fff';
  setTimeout(()=>{btn.textContent=orig;btn.style.background='';btn.style.color='';},1200);
}

// ==============================================================
//  逻辑验证
// ==============================================================
function validateStory(){
  const issues = [];
  if(mainline.length<2) issues.push({t:'warn',m:'主线至少需要2个节点'});
  if(!mainline.some(n=>n.type==='scene')) issues.push({t:'warn',m:'缺少场景节点'});
  mainline.forEach(n=>{
    if(n.children&&n.children.length>0){
      n.children.forEach(c=>{
        const has = Object.values(c.fields).some(v=>v&&v!==''&&v!=='无'&&v!=='?');
        if(!has) issues.push({t:'warn',m:`"${n.fields.title||n.label||'?'}"的子节点缺少内容`});
      });
    }
  });
  const p = $('vpPanel');
  const b = $('vpBody');
  p.classList.add('show');
  b.innerHTML = issues.length===0
    ? '<div class="vp-empty">✅ 结构正常</div>'
    : issues.map(r=>`<div class="vp-item"><div class="vp-dot ${r.t}"></div><div>${esc(r.m)}</div></div>`).join('');
}

// ==============================================================
//  生成故事
// ==============================================================
async function generateStory(){
  if(mainline.length===0){ alert('请先搭建故事'); return; }
  $('genOverlay').classList.add('show');
  $('genBody').innerHTML = '<div class="gen-spinner"></div>构建故事...';

  const timeline = buildTimeline();
  const prompt = `你是一位专业小说作家。根据以下故事蓝图，写出一段流畅的小说段落。

故事蓝图（鱼骨图结构 — 主线按时间排列，子剧情即展开的详细情节）：
${timeline}

要求：
1. 严格按蓝图时间线推进
2. 所有子剧情都融入故事
3. 角色性格和行为一致
4. 因果关系清晰
5. 纯文本不要markdown
6. 600-1200字`;

  try{
    const resp = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer sk-b099309822cf44dfaa1ef01ccc153dd5'},
      body: JSON.stringify({
        model:'deepseek-chat',
        messages:[{role:'system',content:'你是一位专业小说家，擅长根据鱼骨图叙事蓝图生成小说段落。'},
                  {role:'user',content:prompt}],
        temperature:0.8, max_tokens:2500
      })
    });
    if(!resp.ok) throw new Error('API '+resp.status);
    const data = await resp.json();
    $('genBody').innerHTML = `<div style="white-space:pre-wrap;line-height:1.9">${esc(data.choices?.[0]?.message?.content||'')}</div>`;
  } catch(e){
    $('genBody').innerHTML = `<div style="color:var(--orange);margin-bottom:8px">⚠ API不可用，离线模式</div>
      <div style="white-space:pre-wrap;line-height:1.9">${esc(localGen())}</div>`;
  }
}
function closeGen(){ $('genOverlay').classList.remove('show'); }
function copyGen(){
  const t=$('genBody').textContent;
  navigator.clipboard.writeText(t).then(()=>{
    const b=document.querySelector('.gm-copy'); b.textContent='✓ 已复制';
    setTimeout(()=>b.textContent='复制',1200);
  }).catch(()=>alert('复制失败'));
}

function buildTimeline(){
  return mainline.map((n,i)=>{
    const icon = n.icon||getTypeIcon(n.type);
    const title = n.fields.title||n.fields.name||n.label||getTypeLabel(n.type);
    const fs = Object.entries(n.fields).filter(([k,v])=>v&&!['icon','label'].includes(k)).map(([k,v])=>`${k}:${v}`).join(', ');
    let t = `【${i+1}】${icon} ${title} — ${fs}`;
    if(n.children&&n.children.length>0){
      t += '\n  ├ 子剧情:';
      n.children.forEach((c,j)=>{
        const ci = c.icon||getTypeIcon(c.type);
        const ct = c.fields.title||c.fields.name||c.label||getTypeLabel(c.type);
        const cf = Object.entries(c.fields).filter(([k,v])=>v&&!['icon','label'].includes(k)).map(([k,v])=>`${k}:${v}`).join(', ');
        t += `\n  ├── ${j+1}. ${ci} ${ct} — ${cf}`;
        if(c.children2&&c.children2.length>0){
          c.children2.forEach((c2,k)=>{
            const c2t = c2.fields.title||c2.fields.name||c2.label||getTypeLabel(c2.type);
            t += `\n  ├──── ${j+1}.${k+1}. ${c2t}`;
          });
        }
      });
    }
    return t;
  }).join('\n\n');
}

function localGen(){
  return mainline.map(n=>{
    const icon = n.icon||getTypeIcon(n.type);
    const title = n.fields.title||n.fields.name||n.label||getTypeLabel(n.type);
    let t = `${icon} ${title}`;
    if(n.type==='scene') t += `\n${n.fields.time||''}的${n.fields.location||'某处'}，${n.fields.atmosphere||''}。`;
    else if(n.type==='character') t += `\n${n.fields.name||'某人'}（${n.fields.personality||'普通'}），${n.fields.motive||''}。`;
    else if(n.type==='event') t += `\n${n.fields.description||'发生了某事'}。`;
    else if(n.type==='dialogue') t += `\n${n.fields.speaker||'A'}："${n.fields.content||'...'}"`;
    else if(n.type==='choice') t += `\n${n.fields.option_a||'A'} 或 ${n.fields.option_b||'B'}？`;
    if(n.children) n.children.forEach(c=>{ t += `\n  ${c.icon||'•'} ${c.fields.title||c.fields.name||c.label||''}`; });
    return t;
  }).join('\n---\n');
}
