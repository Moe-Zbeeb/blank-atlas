const fs=require('fs'),path=require('path'),{execFileSync}=require('child_process');
const d3=require('d3-geo'),topojson=require('topojson-client');
const root=__dirname,pub=path.join(root,'public');
const data=JSON.parse(fs.readFileSync(path.join(root,'data.json'),'utf8'));
const feats=topojson.feature(data.topo,data.topo.objects.countries).features.filter(f=>f.id!=='AQ');
const region=new Map(data.countries.map(c=>[c.id,c.r]));
const tints=['#e8cf8f','#b3d29b','#ecb3aa','#c4bbe6','#9bcfca'];
const charted=new Set(['samerica','europe']);
const W=1200,H=630;
const proj=d3.geoNaturalEarth1().rotate([-11,0]).fitExtent([[430,60],[1180,590]],{type:'Sphere'});
const p=d3.geoPath(proj);
let i=0;
const lands=feats.map(f=>{
  const r=region.get(f.id),fill=r&&charted.has(r)?tints[(i++)%5]:'url(#h)';
  return `<path d="${p(f)}" fill="${fill}" stroke="#6c7f85" stroke-width="0.7" stroke-linejoin="round"/>`;
}).join('');
const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<defs><pattern id="h" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="5" height="5" fill="#f6f4ee"/><line x1="0" y1="0" x2="0" y2="5" stroke="#d8d3c4" stroke-width="1.4"/></pattern></defs>
<rect width="${W}" height="${H}" fill="#cddee3"/>
<path d="${p(d3.geoGraticule10())}" fill="none" stroke="#bfd3d9" stroke-width="0.8"/>
<path d="${p({type:'Sphere'})}" fill="none" stroke="#bfd3d9" stroke-width="1"/>
${lands}
<g transform="translate(56,150)">
<rect width="420" height="330" rx="20" fill="#f1f3ef" stroke="#d5dcdb" stroke-width="2"/>
<rect x="7" y="7" width="406" height="316" rx="14" fill="none" stroke="#d5dcdb" stroke-width="1.5"/>
<text x="40" y="100" font-family="Georgia, 'Times New Roman', serif" font-style="italic" font-size="68" fill="#16242a">Blank Atlas</text>
<text x="42" y="140" font-family="Georgia, serif" font-style="italic" font-size="22" fill="#5a6a70">Charted by Mohamad Zbib</text>
<text x="40" y="200" font-family="'Helvetica Neue', Arial, sans-serif" font-size="26" font-weight="700" fill="#16242a">Learn every country</text>
<text x="40" y="234" font-family="'Helvetica Neue', Arial, sans-serif" font-size="26" font-weight="700" fill="#16242a">on the world map.</text>
<rect x="40" y="262" width="250" height="40" rx="20" fill="#c8157e"/>
<text x="165" y="289" text-anchor="middle" font-family="'Helvetica Neue', Arial, sans-serif" font-size="18" font-weight="700" fill="#ffffff">blank-atlas.pages.dev</text>
</g>
</svg>`;
fs.writeFileSync(path.join(root,'og.svg'),svg);
const rsvg=(src,out,w,h)=>execFileSync('rsvg-convert',['-w',String(w),'-h',String(h),'-o',out,src]);
rsvg(path.join(root,'og.svg'),path.join(pub,'og.png'),W,H);
for(const n of [180,192,512])rsvg(path.join(pub,'icon.svg'),path.join(pub,`icon-${n}.png`),n,n);
fs.unlinkSync(path.join(root,'og.svg'));
for(const f of ['og.png','icon-180.png','icon-192.png','icon-512.png'])console.log(f,(fs.statSync(path.join(pub,f)).size/1024).toFixed(0)+' KB');
