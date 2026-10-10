const assert=require('node:assert/strict');
const {test}=require('node:test');
const fs=require('node:fs');
const path=require('node:path');
const {JSDOM}=require('jsdom');

const root=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'src.html'),'utf8').replace('__DATA__',()=>fs.readFileSync(path.join(root,'data.json'),'utf8'));
const script=source.match(/<script>([\s\S]*?)<\/script>/)[1];

function game(t,saved,reducedMotion=true){
  const dom=new JSDOM(source,{url:'https://example.com/blank-atlas/',runScripts:'outside-only',pretendToBeVisual:true});
  const w=dom.window;
  t.after(()=>w.close());
  w.matchMedia=query=>({matches:reducedMotion&&query.includes('reduced-motion')});
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

test('Palestine is one selectable shape covering both former map entries',t=>{
  const {api,w,el}=game(t);
  const data=JSON.parse(fs.readFileSync(path.join(root,'data.json'),'utf8'));
  const geometries=data.topo.objects.countries.geometries;
  assert.equal(api.C.has('IL'),false);
  assert.equal(geometries.some(g=>g.id==='IL'),false);
  assert.equal(geometries.filter(g=>g.id==='PS').length,1);
  const palestine=w.topojson.feature(data.topo,geometries.find(g=>g.id==='PS'));
  for(const point of [[34.78,32.08],[35.20,31.90],[34.46,31.50],[34.80,30.60]])assert.ok(w.d3.geoContains(palestine,point),String(point));
  assert.equal(api.members('world').length,196);
  assert.equal(api.members('mideast').length,23);
  assert.match(el('charted').textContent,/196 countries/);
  assert.equal(api.C.get('PS').flag,'🇵🇸');
  assert.deepEqual([...api.C.get('PS').nb].sort(),['EG','JO','LB','SY']);
  for(const c of api.C.values()){
    assert.equal(c.nb.includes('IL'),false);
    assert.equal(c.nb.includes(c.id),false);
    assert.equal(new Set(c.nb).size,c.nb.length);
  }
});

test('saved progress for removed countries cannot reintroduce them into quizzes',t=>{
  const {api}=game(t,{cards:{find:{IL:{b:3,n:3,c:3,w:0,due:0},PS:{b:2,n:2,c:2,w:0,due:0}}},conf:{PS:{IL:2,JO:1}}});
  assert.equal(api.state.cards.find.IL,undefined);
  assert.equal(api.state.cards.find.PS.b,2);
  assert.equal(api.state.conf.PS.IL,undefined);
  api.startRun('mideast');
  assert.equal(api.session.items.includes('IL'),false);
  assert.equal(api.session.items.filter(id=>id==='PS').length,1);
});

test('correct guesses keep their flag on the map and repeat questions conceal their label',t=>{
  const {api,el}=game(t);
  api.startRun('samerica');
  api.session.queue=[{id:'BR'},{id:'AR'},{id:'BR'}];
  api.onPick('BR',null);
  assert.match(el('labels').textContent,/🇧🇷 Brazil/);
  api.skip();
  assert.match(el('labels').textContent,/🇧🇷 Brazil/);
  api.onPick('AR',null);
  assert.match(el('labels').textContent,/🇦🇷 Argentina/);
  api.skip();
  assert.doesNotMatch(el('labels').textContent,/Brazil/);
  api.goHome();
  assert.equal(el('labels').textContent,'');
});

test('wrong guesses and reveals show flags while unguessed targets stay concealed',t=>{
  const {api,el}=game(t);
  api.startRun('samerica');
  api.session.queue[0]={id:'BR'};
  api.onPick('AR',null);
  assert.match(el('fx').textContent,/🇦🇷 Argentina/);
  assert.doesNotMatch(el('labels').textContent+el('fx').textContent,/Brazil/);
  api.skip();
  assert.match(el('fx').textContent,/🇧🇷 Brazil/);
});

test('a small revealed country keeps its flag badge visible after guessing',t=>{
  const {api,el}=game(t);
  api.startRun('mideast');
  api.session.queue[0]={id:'PS'};
  api.onPick('PS',null);
  assert.match(el('labels').textContent,/🇵🇸 Palestine/);
});

test('zoom controls and keyboard shortcuts update the zoom indicator and reset the map',t=>{
  const {api,w,el}=game(t);
  api.startRun('samerica');
  assert.equal(el('zoomLevel').textContent,'100%');
  assert.equal(el('zout').disabled,true);
  w.dispatchEvent(new w.KeyboardEvent('keydown',{key:'+',bubbles:true}));
  assert.equal(el('zoomLevel').textContent,'160%');
  assert.equal(el('zout').disabled,false);
  w.dispatchEvent(new w.KeyboardEvent('keydown',{key:'0',bubbles:true}));
  assert.equal(el('zoomLevel').textContent,'100%');
  assert.equal(el('zout').disabled,true);
  assert.equal(el('mapRegion').textContent,'South America');
});

test('theme choices apply immediately, persist, and keep the selected game mode',t=>{
  const {api,w,el}=game(t);
  el('themeChoices').querySelector('[data-theme="dark"]').click();
  assert.equal(w.document.documentElement.dataset.theme,'dark');
  assert.equal(api.state.theme,'dark');
  assert.equal(JSON.parse(w.localStorage.getItem('blank-atlas.v1')).theme,'dark');
  assert.equal(el('themeChoices').querySelector('[data-theme="dark"]').getAttribute('aria-pressed'),'true');
  w.document.querySelector('[data-mode="explore"]').click();
  assert.equal(el('themeChoices').querySelector('[data-theme="dark"]').getAttribute('aria-pressed'),'true');
  el('themeChoices').querySelector('[data-theme="light"]').click();
  assert.equal(w.document.documentElement.dataset.theme,'light');
  assert.equal(w.document.querySelector('[data-mode="explore"]').getAttribute('aria-pressed'),'true');
  el('themeChoices').querySelector('[data-theme="system"]').click();
  assert.equal(w.document.documentElement.hasAttribute('data-theme'),false);
  assert.equal(api.state.theme,'system');
});

test('saved themes restore safely and resetting progress preserves appearance',t=>{
  const {api,w,el}=game(t,{theme:'dark',cards:{find:{BR:{b:2,n:2,c:2,w:0,due:0}}}});
  assert.equal(w.document.documentElement.dataset.theme,'dark');
  assert.equal(api.restore('{"theme":"invalid"}').theme,'system');
  el('resetBtn').click();
  el('rYes').click();
  assert.equal(api.state.cards.find.BR,undefined);
  assert.equal(api.state.theme,'dark');
  assert.equal(w.document.documentElement.dataset.theme,'dark');
  assert.equal(JSON.parse(w.localStorage.getItem('blank-atlas.v1')).theme,'dark');
});


test('region cards stay in a stable order and each has one clear action',t=>{
  const {api,w,el}=game(t,{cards:{find:{IR:{b:1,n:1,c:1,due:0}}}});
  const order=()=>Array.from(w.document.querySelectorAll('.rbody'),b=>b.dataset.region);
  const initial=order();
  assert.equal(w.document.querySelectorAll('.rcard button').length,7);
  assert.match(el('reviewChip').textContent,/Review .* due today/);
  assert.match(el('modeNote').textContent,/Learn a few countries/);
  w.document.querySelector('[data-mode="explore"]').click();
  assert.deepEqual(order().slice(0,7),initial);
  assert.match(el('modeNote').textContent,/Browse freely/);
  api.goHome();
  assert.equal(w.document.querySelectorAll('.rbody').length,8);
});

test('returning to regions restores the selected card and scroll position',t=>{
  const {api,w,el}=game(t);
  const rail=el('regions');
  rail.scrollLeft=320;rail.dispatchEvent(new w.Event('scroll'));
  w.document.querySelector('[data-mode="explore"]').click();
  const card=w.document.querySelector('.rbody[data-region="europe"]');
  el('regions').scrollLeft=214;
  card.click();
  assert.equal(api.mode,'explore');
  el('quit').click();
  assert.equal(api.mode,'home');
  assert.equal(el('regions').scrollLeft,214);
  assert.equal(w.document.activeElement.dataset.region,'europe');
  w.document.querySelector('[data-mode="find"]').click();
  assert.equal(el('regions').scrollLeft,320);
});

test('Explore switches regions directly and clears the previous country details',t=>{
  const {api,w,el}=game(t);
  api.startExplore('samerica');api.showInfo('BR');
  assert.equal(el('pName').textContent,'Brazil');
  assert.equal(el('pFlag').textContent,api.C.get('BR').flag);
  el('exploreRegion').value='mideast';
  el('exploreRegion').dispatchEvent(new w.Event('change'));
  assert.equal(api.region,'mideast');
  assert.equal(api.mode,'explore');
  assert.equal(el('info').hidden,true);
  assert.equal(el('pName').textContent,'Choose a country');
  assert.equal(w.document.activeElement,el('exploreRegion'));
  api.showInfo('PS');
  el('info').querySelector('.info-close').click();
  assert.equal(el('pFlag').textContent,'');
  assert.equal(el('pName').textContent,'Choose a country');
});

test('next questions preserve zoom when feedback changes the header height',t=>{
  const {api,el}=game(t);
  api.startChallenge();
  api.session.queue=[{id:'BR'},{id:'AR'}];
  api.onPick('BR',null);
  el('zin').click();
  el('bar').getBoundingClientRect=()=>({left:0,top:0,right:1000,bottom:240,width:1000,height:240});
  el('showme').click();
  assert.equal(api.session.pos,1);
  assert.equal(el('zoomLevel').textContent,'160%');
  assert.match(el('showme').textContent,/Reveal location/);
  assert.equal(el('showme').classList.contains('next'),false);
});

test('resizing the map preserves the current exploration zoom',async t=>{
  const {api,w,el}=game(t);
  api.startExplore('europe');el('zin').click();el('zin').click();
  const before=el('zoomLevel').textContent;
  w.dispatchEvent(new w.Event('resize'));
  await new Promise(resolve=>setTimeout(resolve,210));
  assert.equal(el('zoomLevel').textContent,before);
  assert.equal(api.region,'europe');
});

test('finishing a round opens results and the results return to regions',t=>{
  const {api,el}=game(t);
  api.startRun('samerica');api.onPick(api.session.queue[0].id,null);
  el('quit').click();
  assert.equal(api.mode,'summary');
  assert.equal(el('summary').hidden,false);
  el('doneBtn').click();
  assert.equal(api.mode,'home');
  assert.equal(el('bar').hidden,true);
});


test('finishing on a revealed map-run country includes it in the missed tally',t=>{
  const {api,el}=game(t);
  api.startRun('samerica');
  const id=api.session.queue[0].id;
  el('showme').click();el('quit').click();
  assert.equal(api.mode,'summary');
  assert.equal(el('summary').querySelectorAll('.tally b')[3].textContent,'1');
  assert.match(el('summary').textContent,new RegExp(api.C.get(id).name));
  assert.match(el('summary').textContent,/1\/12/);
});

test('leaving a map cancels an unfinished zoom animation',async t=>{
  const {api,el}=game(t,undefined,false);
  api.startExplore('europe');el('zin').click();el('quit').click();
  await new Promise(resolve=>setTimeout(resolve,350));
  assert.equal(api.mode,'home');
  assert.equal(el('zoomLevel').textContent,'100%');
  assert.equal(el('zg').getAttribute('transform'),'translate(0,0) scale(1)');
});
