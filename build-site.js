const fs=require('fs'),path=require('path'),crypto=require('crypto');
const root=__dirname;
const src=fs.readFileSync(path.join(root,'src.html'),'utf8');
const data=fs.readFileSync(path.join(root,'data.json'),'utf8');
const page=src.replace('__DATA__',()=>data);
fs.writeFileSync(path.join(root,'index.html'),page);

const dist=path.join(root,'dist');
fs.rmSync(dist,{recursive:true,force:true});
fs.mkdirSync(path.join(dist,'vendor'),{recursive:true});
fs.copyFileSync(path.join(root,'node_modules/d3/dist/d3.min.js'),path.join(dist,'vendor/d3.min.js'));
fs.copyFileSync(path.join(root,'node_modules/topojson-client/dist/topojson-client.min.js'),path.join(dist,'vendor/topojson-client.min.js'));
for(const f of fs.readdirSync(path.join(root,'public')))fs.copyFileSync(path.join(root,'public',f),path.join(dist,f));

let body=page
  .replace(/<script src="https:\/\/cdnjs[^"]*d3[^"]*"><\/script>/,'<script src="vendor/d3.min.js"></script>')
  .replace(/<script src="https:\/\/cdn\.jsdelivr[^"]*topojson[^"]*"><\/script>/,'<script src="vendor/topojson-client.min.js"></script>');
if(body.includes('cdnjs.cloudflare.com')||body.includes('cdn.jsdelivr.net'))throw new Error('CDN script left in dist build');
const split=body.indexOf('<div id="app">');
const head=body.slice(0,split).replace(/<meta name="viewport"[^>]*>\n?/,'');
const rest=body.slice(split);
const html=`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="description" content="Learn every country on the world map. Click to find countries, chart your own atlas, and play with a friend.">
<meta name="theme-color" content="#f1f3ef" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#0f181b" media="(prefers-color-scheme: dark)">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="Blank Atlas">
<meta property="og:title" content="Blank Atlas">
<meta property="og:description" content="Learn every country on the world map, one click at a time.">
<meta property="og:type" content="website">
<link rel="icon" href="icon.svg" type="image/svg+xml">
<link rel="manifest" href="manifest.webmanifest">
${head.trim()}
</head>
<body>
${rest.trim()}
<script>if('serviceWorker' in navigator&&location.protocol!=='file:')addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));</script>
</body>
</html>
`;
fs.writeFileSync(path.join(dist,'index.html'),html);
const version=crypto.createHash('sha1').update(html).digest('hex').slice(0,10);
const sw=path.join(dist,'sw.js');
fs.writeFileSync(sw,fs.readFileSync(sw,'utf8').replace('__VERSION__',version));
const kb=f=>(fs.statSync(path.join(dist,f)).size/1024).toFixed(0)+' KB';
console.log('built index.html (artifact) and dist/ (version '+version+')');
for(const f of ['index.html','vendor/d3.min.js','vendor/topojson-client.min.js'])console.log('  dist/'+f,kb(f));
