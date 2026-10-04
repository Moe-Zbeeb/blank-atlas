const assert=require('node:assert/strict');
const {test}=require('node:test');
const fs=require('node:fs');
const path=require('node:path');
const {JSDOM}=require('jsdom');

const root=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'src.html'),'utf8').replace('__DATA__',()=>fs.readFileSync(path.join(root,'data.json'),'utf8'));
const script=source.match(/<script>([\s\S]*?)<\/script>/)[1];

function game(t,saved){
  const dom=new JSDOM(source,{url:'https://example.com/blank-atlas/',runScripts:'outside-only',pretendToBeVisual:true});
  const w=dom.window;
  t.after(()=>w.close());
  w.matchMedia=query=>({matches:query.includes('reduced-motion')});
  w.SVGElement.prototype.getBoundingClientRect=function(){return{left:0,top:0,right:1000,bottom:700,width:1000,height:700}};
  w.SVGElement.prototype.getBBox=function(){return{x:0,y:0,width:100,height:100}};
  Object.defineProperties(w.SVGElement.prototype,{
    width:{get:()=>({baseVal:{value:1000}})},
    height:{get:()=>({baseVal:{value:700}})}
  });
  w.HTMLElement.prototype.getBoundingClientRect=function(){
    const top=this.id==='homeBottom'?450:0,bottom=this.id==='bar'||this.classList.contains('cartouche')?180:top+100;
    return{left:0,top,right:1000,bottom,width:1000,height:bottom-top};
  };
  if(saved!==undefined)w.localStorage.setItem('blank-atlas.v1',typeof saved==='string'?saved:JSON.stringify(saved));
  w.eval(fs.readFileSync(path.join(root,'node_modules/d3/dist/d3.min.js'),'utf8'));
  w.eval(fs.readFileSync(path.join(root,'node_modules/topojson-client/dist/topojson-client.min.js'),'utf8'));
  w.eval(script+`;window.gameTest={get state(){return S},get session(){return sess},get mode(){return mode},get region(){return curRegion},C,members,recommended,regionStats,startSession,startChallenge,startTeam,startRun,onPick,skip,grade,goHome,startExplore,showInfo,restore,project,today};`);
  const api=w.gameTest;
  api.state.sound=false;
  return{w,api,el:id=>w.document.getElementById(id)};
}

test('all seven regions are available on the home screen',t=>{
  const {w,el}=game(t);
  assert.equal(w.document.querySelectorAll('.rcard').length,7);
  assert.equal(el('home').hidden,false);
  assert.match(el('regionHint').textContent,/choose a region/);
});

test('invalid saved fields recover without losing valid country progress',t=>{
  const {api}=game(t,{cards:{find:{BR:{b:2,n:3,c:2,w:1,due:123},XX:{b:3},AR:null}},days:null,goal:null,conf:null,team:{region:'invalid',rounds:99}});
  assert.equal(api.state.cards.find.BR.b,2);
  assert.equal(api.state.days.length,0);
  assert.equal(api.state.goal.n,0);
  assert.equal(api.state.cards.find.XX,undefined);
  assert.equal(api.state.cards.find.AR,undefined);
  assert.equal(api.state.team,undefined);
});

test('malformed JSON and missing card collections do not break startup',t=>{
  const {api}=game(t,'{broken');
  assert.equal(api.regionStats('world').charted,0);
  assert.equal(Object.keys(api.restore('{"cards":{"find":null}}').cards.find).length,0);
});

test('recommendations move to an uncharted region after completing the first region',t=>{
  const {api}=game(t);
  for(const id of api.members('samerica'))api.state.cards.find[id]={b:1,n:1,c:1,w:0,due:Date.now()+86400000};
  assert.equal(api.recommended().id,'europe');
});

test('wrong answers do not count as charted countries',t=>{
  const {api}=game(t);
  api.state.cards.find.BR={b:0,n:1,c:0,w:1,due:0};
  assert.equal(api.regionStats('samerica').charted,0);
});

test('learning introductions have a visible Continue action',t=>{
  const {api,el}=game(t);
  api.startSession({kind:'learn',region:'samerica'});
  assert.equal(api.session.phase,'teach');
  assert.equal(el('showme').hidden,false);
  assert.match(el('showme').textContent,/Continue/);
  el('showme').click();
  assert.equal(api.session.pos,1);
});

test('correct answers stay on screen until Next and repeated map taps do not add points',t=>{
  const {api,el}=game(t);
  api.startChallenge();
  const id=api.session.queue[0].id;
  api.onPick(id,null);
  assert.equal(api.session.phase,'feedback');
  assert.equal(api.session.pos,0);
  assert.equal(api.state.goal.n,1);
  api.onPick(id,null);
  assert.equal(api.state.goal.n,1);
  assert.match(el('showme').textContent,/Next country/);
  el('showme').click();
  assert.equal(api.session.pos,1);
});

test('Space on a focused action button does not trigger both global and button actions',t=>{
  const {api,w,el}=game(t);
  api.startChallenge();
  api.onPick(api.session.queue[0].id,null);
  el('showme').dispatchEvent(new w.KeyboardEvent('keydown',{key:' ',bubbles:true,cancelable:true}));
  assert.equal(api.session.pos,0);
  el('showme').click();
  assert.equal(api.session.pos,1);
});

test('repeated practice on one day cannot earn mastery',t=>{
  const {api}=game(t);
  for(let i=0;i<3;i++){
    api.startSession({kind:'learn',region:'samerica'});
    api.grade('BR',true);
  }
  assert.equal(api.state.cards.find.BR.b,1);
  api.state.cards.find.BR.lastDay='2000-01-01';
  api.startSession({kind:'learn',region:'samerica'});
  api.grade('BR',true);
  assert.equal(api.state.cards.find.BR.b,2);
  api.state.cards.find.BR.lastDay='2000-01-02';
  api.startSession({kind:'learn',region:'samerica'});
  api.grade('BR',true);
  assert.equal(api.state.cards.find.BR.b,3);
});

test('team neighbour guesses earn one point and reveals cannot earn three more',t=>{
  const {api}=game(t);
  api.startTeam('europe',10);
  const s=api.session;
  const index=s.queue.findIndex(q=>api.C.get(q.id).nb.length>0);
  [s.queue[0].id,s.queue[index].id]=[s.queue[index].id,s.queue[0].id];
  const id=s.queue[0].id,neighbour=api.C.get(id).nb[0];
  api.onPick(neighbour,null);
  assert.equal(s.score[0],1);
  assert.equal(s.phase,'reveal');
  api.onPick(id,null);
  assert.equal(s.score[0],1);
  assert.equal(s.phase,'feedback');
  assert.equal(s.owner[id],undefined);
});

test('country details close with their button and Escape without leaving Explore',t=>{
  const {api,w,el}=game(t);
  api.startExplore('samerica');
  api.showInfo('BR');
  assert.equal(el('info').hidden,false);
  el('info').querySelector('.info-close').click();
  assert.equal(el('info').hidden,true);
  api.showInfo('AR');
  w.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
  assert.equal(el('info').hidden,true);
  assert.equal(api.mode,'explore');
});

test('an old challenge timer cannot start a second clock in a new challenge',t=>{
  const {api,w}=game(t);
  const timers=[];
  w.setTimeout=(fn,delay)=>{timers.push({fn,delay});return timers.length};
  api.startChallenge();
  const old=timers.find(timer=>timer.delay===500);
  assert.ok(old);
  api.goHome();
  api.startChallenge();
  const before=timers.filter(timer=>timer.delay===500).length;
  old.fn();
  assert.equal(timers.filter(timer=>timer.delay===500).length,before);
});

test('a completed challenge saves its first score and replays leave it intact',t=>{
  const {api,el}=game(t);
  api.startChallenge();
  while(api.session){api.onPick(api.session.queue[api.session.pos].id,null);api.skip()}
  assert.equal(api.state.chal.score,10);
  assert.equal(el('summary').hidden,false);
  const result=JSON.stringify(api.state.chal);
  api.goHome();
  api.startChallenge();
  assert.equal(api.session.replay,true);
  while(api.session){api.skip();api.skip()}
  assert.equal(JSON.stringify(api.state.chal),result);
});

test('map runs keep their three-try rules and wait for Next after a correct answer',t=>{
  const {api,el}=game(t);
  api.startRun('samerica');
  const id=api.session.queue[0].id,wrong=api.session.items.find(other=>other!==id);
  api.onPick(wrong,null);
  assert.equal(api.session.phase,'ask');
  assert.equal(api.session.att[id],1);
  assert.equal(api.session.res[id],undefined);
  api.onPick(id,null);
  assert.equal(api.session.mark[id],'r2');
  assert.equal(api.session.phase,'feedback');
  el('showme').click();
  assert.equal(api.session.pos,1);
});

test('a full map run saves and restores its best result',t=>{
  const {api}=game(t);
  api.startRun('samerica');
  while(api.session){api.onPick(api.session.queue[api.session.pos].id,null);api.skip()}
  assert.equal(api.state.best.samerica.pct,100);
  const restored=api.restore(JSON.stringify(api.state));
  assert.equal(restored.best.samerica.pct,100);
  assert.equal(restored.best.samerica.ms,api.state.best.samerica.ms);
});

test('skipping a map run reveal records the missed country before advancing',t=>{
  const {api}=game(t);
  api.startRun('samerica');
  const id=api.session.queue[0].id;
  api.skip();
  assert.equal(api.session.phase,'reveal');
  api.skip();
  assert.equal(api.session.mark[id],'rx');
  assert.equal(api.session.pos,1);
});
