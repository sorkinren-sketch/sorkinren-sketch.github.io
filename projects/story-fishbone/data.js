"use strict";

// ─── 预制模板库（分组） ───
const TPL_GROUPS = [
  { name:'场景氛围', icon:'🌅', items:[
    { label:'深夜加班', icon:'🌙', fields:{ title:'深夜加班', time:'凌晨', location:'写字楼', atmosphere:'压抑', purpose:'制造紧张氛围' }},
    { label:'咖啡厅偶遇', icon:'☕', fields:{ title:'咖啡厅偶遇', time:'午后', location:'街角咖啡厅', atmosphere:'温馨', purpose:'轻松场合偶遇' }},
    { label:'雨夜追凶', icon:'🌧', fields:{ title:'雨夜追凶', time:'深夜', location:'空荡街道', atmosphere:'紧张', purpose:'暴雨中追逐' }},
    { label:'豪门晚宴', icon:'🍷', fields:{ title:'豪门晚宴', time:'傍晚', location:'别墅宴会厅', atmosphere:'诡异', purpose:'上流社会暗流' }},
    { label:'废弃医院', icon:'🏚', fields:{ title:'废弃医院', time:'黄昏', location:'郊区废弃医院', atmosphere:'诡异', purpose:'探险或逃亡' }},
    { label:'天台谈判', icon:'🏢', fields:{ title:'天台谈判', time:'黄昏', location:'大楼天台', atmosphere:'紧张', purpose:'绝境对话' }},
    { label:'病房探望', icon:'🏥', fields:{ title:'病房探望', time:'午后', location:'医院病房', atmosphere:'悲伤', purpose:'生离死别' }},
    { label:'婚礼现场', icon:'💒', fields:{ title:'婚礼现场', time:'正午', location:'教堂', atmosphere:'欢快', purpose:'戏剧性冲突' }},
    { label:'地下车库', icon:'🚗', fields:{ title:'地下车库', time:'深夜', location:'商场地下车库', atmosphere:'压抑', purpose:'跟踪或埋伏' }},
    { label:'火车站送别', icon:'🚂', fields:{ title:'火车站送别', time:'清晨', location:'火车站台', atmosphere:'悲伤', purpose:'离别' }},
  ]},
  { name:'人物角色', icon:'👤', items:[
    { label:'职场新人', icon:'👦', fields:{ name:'新人', age:'24岁·应届', personality:'温和', motive:'想证明自己', fear:'被淘汰', goal:'站稳脚跟' }},
    { label:'冷酷上司', icon:'🧑‍💼', fields:{ name:'总监', age:'40岁·总监', personality:'严肃', motive:'巩固地位', fear:'被取代', goal:'掌控全局' }},
    { label:'神秘黑客', icon:'👨‍💻', fields:{ name:'黑客', age:'29岁·自由', personality:'狡猾', motive:'拿钱办事', fear:'身份暴露', goal:'远走高飞' }},
    { label:'黑道大哥', icon:'🕴', fields:{ name:'大哥', age:'45岁·灰产', personality:'暴躁', motive:'守地盘', fear:'被背叛', goal:'吞并对家' }},
    { label:'落魄侦探', icon:'🔍', fields:{ name:'侦探', age:'52岁·私家', personality:'冷静', motive:'查出真相', fear:'过去被挖', goal:'破最后一案' }},
    { label:'富家千金', icon:'👸', fields:{ name:'大小姐', age:'22岁·学生', personality:'冲动', motive:'逃离家族', fear:'被逼联姻', goal:'证明自己' }},
    { label:'善良医生', icon:'👩‍⚕️', fields:{ name:'医生', age:'35岁·急诊', personality:'善良', motive:'救死扶伤', fear:'无力回天', goal:'升主任' }},
    { label:'老警察', icon:'👮', fields:{ name:'老刑警', age:'48岁·队长', personality:'幽默', motive:'追悬案', fear:'退休破不了', goal:'绳之以法' }},
    { label:'失忆者', icon:'😶', fields:{ name:'失忆者', age:'约30岁', personality:'神秘', motive:'找回记忆', fear:'真相更可怕', goal:'搞清自己是谁' }},
    { label:'双面间谍', icon:'🕵', fields:{ name:'双面人', age:'35岁·情报', personality:'狡猾', motive:'两头获利', fear:'身份穿帮', goal:'消失' }},
  ]},
  { name:'冲突事件', icon:'⚡', items:[
    { label:'文件失窃', icon:'📁', fields:{ title:'文件失窃', cause:'内部作案', description:'关键文件不翼而飞', consequence:'主角成嫌疑人', tension:'强烈' }},
    { label:'街头遇袭', icon:'🔪', fields:{ title:'街头遇袭', cause:'买凶警告', description:'被不明身份的人袭击', consequence:'受伤但意识到被盯上', tension:'强烈' }},
    { label:'秘密会面', icon:'🤝', fields:{ title:'秘密会面', cause:'共同利益', description:'与神秘人私下交换情报', consequence:'获线索但暴露行踪', tension:'中等' }},
    { label:'当众揭发', icon:'📢', fields:{ title:'当众揭发', cause:'有人掌握把柄', description:'公开揭露真面目全场哗然', consequence:'身败名裂', tension:'爆发' }},
    { label:'车祸意外', icon:'🚑', fields:{ title:'车祸意外', cause:'动了刹车', description:'看似意外疑点重重', consequence:'伤亡真相被掩盖', tension:'中等' }},
    { label:'电话威胁', icon:'📞', fields:{ title:'电话威胁', cause:'有人想阻止调查', description:'深夜匿名电话知道一切行踪', consequence:'确认方向对了', tension:'强烈' }},
    { label:'密室杀人', icon:'🔒', fields:{ title:'密室杀人', cause:'精心策划', description:'密闭空间发现尸体无凶器', consequence:'真凶在身边', tension:'爆发' }},
    { label:'突然背叛', icon:'🔪', fields:{ title:'突然背叛', cause:'利益/恐惧', description:'最信任的人在关键时刻倒戈', consequence:'陷入绝境', tension:'爆发' }},
    { label:'惊天发现', icon:'💡', fields:{ title:'惊天发现', cause:'翻到不该看的东西', description:'发现被刻意隐藏的秘密', consequence:'世界观颠覆', tension:'强烈' }},
    { label:'救人质', icon:'🚨', fields:{ title:'救人质', cause:'被绑架要挟', description:'限时内找到人质', consequence:'成功升华/失败惨痛', tension:'爆发' }},
  ]},
  { name:'对话冲突', icon:'💬', items:[
    { label:'质问对质', icon:'😠', fields:{ speaker:'A', listener:'B', content:'"你到底隐瞒了什么？"', subtext:'给最后一次坦白机会', emotion:'愤怒' }},
    { label:'坦白真相', icon:'😔', fields:{ speaker:'A', listener:'B', content:'"其实那天晚上的人是我。"', subtext:'终于鼓起勇气', emotion:'悲伤' }},
    { label:'最后通牒', icon:'⏰', fields:{ speaker:'A', listener:'B', content:'"三天后我来替你做决定。"', subtext:'施压背后是掌控欲', emotion:'冷漠' }},
    { label:'讽刺挖苦', icon:'🙄', fields:{ speaker:'A', listener:'B', content:'"哟，大忙人还记得我？"', subtext:'在意对方不联系', emotion:'讽刺' }},
    { label:'深情告白', icon:'💕', fields:{ speaker:'A', listener:'B', content:'"我怕再不说就没机会了。"', subtext:'明知会被拒', emotion:'激动' }},
    { label:'临终遗言', icon:'🕊', fields:{ speaker:'A', listener:'B', content:'"帮我照顾好她……柜子里有文件。"', subtext:'最后的话藏线索', emotion:'恐惧' }},
    { label:'电话暗语', icon:'👂', fields:{ speaker:'A', listener:'B', content:'"东西拿到了。老地方见。"', subtext:'暗语传递信息', emotion:'紧张' }},
    { label:'吵架爆发', icon:'💥', fields:{ speaker:'A', listener:'B', content:'"你从来就没信过我！"', subtext:'累积情绪爆发', emotion:'愤怒' }},
    { label:'劝降游说', icon:'🤔', fields:{ speaker:'A', listener:'B', content:'"你只是走错了路。还来得及。"', subtext:'攻心为上', emotion:'平静' }},
    { label:'求救电话', icon:'🆘', fields:{ speaker:'A', listener:'B', content:'"快来……地下室……他们设了陷阱。"', subtext:'断断续续的求救', emotion:'恐惧' }},
  ]},
  { name:'关键抉择', icon:'🔀', items:[
    { label:'正义VS利益', icon:'⚖', fields:{ title:'告发还是掩盖', option_a:'报警揭发', result_a:'正义伸张但有风险', option_b:'私下处理', result_b:'得好处但良心不安', stakes:'职业和道德', time_pressure:'紧迫' }},
    { label:'救人VS任务', icon:'🏃', fields:{ title:'救还是追', option_a:'先救人', result_a:'任务失败救了命', option_b:'继续追', result_b:'任务完成有人死', stakes:'人命和成败', time_pressure:'非常紧迫' }},
    { label:'信任VS怀疑', icon:'🤨', fields:{ title:'信还是不信', option_a:'选择信任', result_a:'可能被背叛', option_b:'保持怀疑', result_b:'安全但错过帮助', stakes:'人身安全', time_pressure:'无' }},
    { label:'坦白VS隐瞒', icon:'🤐', fields:{ title:'说还是不说', option_a:'坦白一切', result_a:'获谅解但失去信任', option_b:'继续隐瞒', result_b:'表面维持裂痕加深', stakes:'关系存续', time_pressure:'紧迫' }},
    { label:'进攻VS防守', icon:'⚔', fields:{ title:'主动还是等待', option_a:'主动出击', result_a:'打措手不及但暴露', option_b:'按兵不动', result_b:'安全但错失良机', stakes:'主动权', time_pressure:'紧迫' }},
    { label:'牺牲VS保全', icon:'🛡', fields:{ title:'牺牲还是保全', option_a:'自己扛', result_a:'牺牲自己换他人安全', option_b:'让别人承担', result_b:'安全但良心谴责', stakes:'生命重量', time_pressure:'非常紧迫' }},
    { label:'留下VS离开', icon:'🚪', fields:{ title:'留下还是离开', option_a:'留下来面对', result_a:'直面可能更糟', option_b:'转身离开', result_b:'暂时安全', stakes:'人生方向', time_pressure:'无' }},
  ]},
  { name:'内心独白', icon:'🌊', items:[
    { label:'绝望边缘', icon:'🌑', fields:{ character:'角色', emotion:'从希望到绝望', inner_thought:'"也许放弃才是最好的选择……"' }},
    { label:'愤怒爆发', icon:'🔥', fields:{ character:'角色', emotion:'从平静到波动', inner_thought:'"凭什么？为什么总是我！"' }},
    { label:'坚定决心', icon:'💪', fields:{ character:'角色', emotion:'从迷茫到坚定', inner_thought:'"这件事我必须做到底。"' }},
    { label:'内心挣扎', icon:'⚡', fields:{ character:'角色', emotion:'从平静到波动', inner_thought:'"两个都是错的，可我没第三个选项。"' }},
    { label:'幡然醒悟', icon:'✨', fields:{ character:'角色', emotion:'从迷茫到坚定', inner_thought:'"原来我都看错了。真相就在眼前。"' }},
  ]},
  { name:'转场过渡', icon:'⏩', items:[
    { label:'一夜之后', icon:'🌅', fields:{ type:'时间跳跃', gap:'第二天清晨', note:'' }},
    { label:'时光飞逝', icon:'📅', fields:{ type:'时间跳跃', gap:'三个月后', note:'' }},
    { label:'多年以后', icon:'🕰', fields:{ type:'时间跳跃', gap:'三年后', note:'' }},
    { label:'场景转换', icon:'🔄', fields:{ type:'空间转移', gap:'从A城到B城', note:'切换叙事线' }},
    { label:'视角切换', icon:'👁', fields:{ type:'视角切换', gap:'', note:'换角色视角' }},
    { label:'章末', icon:'📖', fields:{ type:'章节结束', gap:'', note:'本章完' }},
  ]},
];

// ─── 数据类型字段定义 ───
const TYPE_FIELDS = {
  scene: [
    { id:'title', label:'场景名', type:'text', def:'' },
    { id:'time', label:'时间', type:'text', def:'' },
    { id:'location', label:'地点', type:'text', def:'' },
    { id:'atmosphere', label:'氛围', type:'pill', def:'平静', opts:['平静','压抑','紧张','欢快','神秘','悲伤','诡异','宏大','温馨','混乱'] },
    { id:'purpose', label:'场景目的', type:'area', def:'', ph:'这个场景想表达什么？' },
  ],
  character: [
    { id:'name', label:'角色名', type:'text', def:'' },
    { id:'age', label:'年龄/身份', type:'text', def:'' },
    { id:'personality', label:'性格', type:'pill', def:'温和', opts:['暴躁','温和','冷静','冲动','狡猾','善良','自私','勇敢','懦弱','幽默','严肃','神秘'] },
    { id:'motive', label:'动机', type:'text', def:'' },
    { id:'fear', label:'恐惧/弱点', type:'text', def:'' },
    { id:'goal', label:'目标', type:'text', def:'' },
  ],
  event: [
    { id:'title', label:'事件名', type:'text', def:'' },
    { id:'cause', label:'原因', type:'text', def:'' },
    { id:'description', label:'描述', type:'area', def:'', ph:'事件经过...' },
    { id:'consequence', label:'后果', type:'text', def:'' },
    { id:'tension', label:'冲突强度', type:'pill', def:'中等', opts:['轻微','中等','强烈','爆发'] },
  ],
  dialogue: [
    { id:'speaker', label:'说话者', type:'text', def:'' },
    { id:'listener', label:'倾听者', type:'text', def:'' },
    { id:'content', label:'对话内容', type:'area', def:'', ph:'"..."' },
    { id:'subtext', label:'潜台词', type:'text', def:'', ph:'真正想表达什么？' },
    { id:'emotion', label:'情绪', type:'pill', def:'平静', opts:['愤怒','悲伤','喜悦','恐惧','讽刺','平静','激动','冷漠','紧张'] },
  ],
  choice: [
    { id:'title', label:'抉择点', type:'text', def:'' },
    { id:'option_a', label:'选项A', type:'text', def:'' },
    { id:'result_a', label:'A的后果', type:'text', def:'' },
    { id:'option_b', label:'选项B', type:'text', def:'' },
    { id:'result_b', label:'B的后果', type:'text', def:'' },
    { id:'stakes', label:'赌注', type:'text', def:'' },
    { id:'time_pressure', label:'时间压力', type:'pill', def:'无', opts:['无','紧迫','非常紧迫','倒计时'] },
  ],
  mood: [
    { id:'character', label:'角色', type:'text', def:'' },
    { id:'emotion', label:'情绪变化', type:'pill', def:'从平静到波动', opts:['从平静到波动','从愤怒到冷静','从恐惧到勇气','从喜悦到悲伤','从希望到绝望','从迷茫到坚定'] },
    { id:'inner_thought', label:'内心独白', type:'area', def:'', ph:'内心真实想法' },
  ],
  transition: [
    { id:'type', label:'转场类型', type:'pill', def:'时间跳跃', opts:['时间跳跃','空间转移','视角切换','章节结束'] },
    { id:'gap', label:'跨度', type:'text', def:'' },
    { id:'note', label:'备注', type:'text', def:'' },
  ],
};

// ─── 辅助 ───
function getTypeIcon(t){ return {scene:'🌅',character:'👤',event:'⚡',dialogue:'💬',choice:'🔀',mood:'🌊',transition:'⏩'}[t]||'📌'; }
function getTypeLabel(t){ return {scene:'场景',character:'角色',event:'事件',dialogue:'对话',choice:'抉择',mood:'心境',transition:'转场'}[t]||t; }
function getDefaultFields(type, tplLabel){
  const fields = {};
  (TYPE_FIELDS[type]||[]).forEach(f => fields[f.id] = f.def||'');
  if(tplLabel && tplLabel !== '__custom__'){
    for(const g of TPL_GROUPS) for(const it of g.items){
      if(it.label === tplLabel){ Object.assign(fields, JSON.parse(JSON.stringify(it.fields))); return fields; }
    }
  }
  return fields;
}
