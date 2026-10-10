const topojson=require('topojson-client');
const simp=require('topojson-simplify');
const topo=JSON.parse(JSON.stringify(require('world-atlas/countries-50m.json')));
const wc=require('world-countries');
const mapId=id=>id==='IL'?'PS':id;
const sov=wc.filter(c=>c.cca2!=='IL'&&(c.unMember||['VA','PS','XK','TW'].includes(c.cca2)));
const byN=new Map(wc.map(c=>[c.ccn3,c]));
const cca3to2=new Map(wc.map(c=>[c.cca3,c.cca2]));
const sovSet=new Set(sov.map(c=>c.cca2));
const merge={Somaliland:'SO','N. Cyprus':'CY'};
const geoms=topo.objects.countries.geometries.filter(g=>g.properties.name!=='Antarctica');
const groups=new Map();
for(const g of geoms){
  let key;
  if(merge[g.properties.name]) key=merge[g.properties.name];
  else if(g.properties.name==='Kosovo') key='XK';
  else if(g.id&&byN.get(g.id)) key=mapId(byN.get(g.id).cca2);
  else key='~'+g.properties.name;
  if(!groups.has(key))groups.set(key,[]);
  groups.get(key).push(g);
}
let t=simp.presimplify(topo);
t=simp.simplify(t,simp.quantile(t,0.25));
const out=[];
for(const [key,gs] of groups){
  let geom;
  if(gs.length===1){geom=gs[0];}
  else geom=topojson.mergeArcs(t,gs);
  const c=sovSet.has(key)?null:byN.get(gs[0].id);
  out.push({type:geom.type,arcs:geom.arcs,id:key,properties:sovSet.has(key)?{}:{n:c?c.name.common:key.slice(1)}});
}
t.arcs=t.arcs.map(a=>a.map(p=>[p[0],p[1]]));t.objects={countries:{type:'GeometryCollection',geometries:out}};
const regionOf=c=>{
  const s=c.subregion;
  if(c.region==='Africa')return'africa';
  if(c.region==='Europe')return'europe';
  if(c.region==='Oceania')return'oceania';
  if(s==='South America')return'samerica';
  if(c.region==='Americas')return'namerica';
  if(s==='Western Asia'||s==='Central Asia'||c.cca2==='IR'||c.cca2==='AF')return'mideast';
  return'asia';
};
const countries=sov.map(c=>({
  id:c.cca2,
  name:c.name.common==='DR Congo'?'DR Congo':c.name.common,
  alt:[...new Set([c.name.official,...(c.altSpellings||[]).filter(a=>a.length>3)])].filter(a=>a!==c.name.common),
  cap:(c.capital||[])[0]||'',
  flag:c.flag,
  r:regionOf(c),
  ll:c.latlng,
  area:Math.round(c.area+(c.cca2==='PS'?wc.find(x=>x.cca2==='IL').area:0)),
  nb:[...new Set((c.cca2==='PS'?[...(c.borders||[]),...wc.find(x=>x.cca2==='IL').borders]:c.borders||[]).map(b=>mapId(cca3to2.get(b))).filter(b=>b!==c.cca2&&sovSet.has(b)))],
}));
const fs=require('fs');
const q=topojson.quantize(t,1e5);fs.writeFileSync('data.json',JSON.stringify({topo:q,countries}));
console.log('size',fs.statSync('data.json').size, 'countries',countries.length);
const cnt={};countries.forEach(c=>cnt[c.r]=(cnt[c.r]||0)+1);console.log(cnt);
console.log(countries.filter(c=>c.r==='mideast').map(c=>c.name).join(', '));
