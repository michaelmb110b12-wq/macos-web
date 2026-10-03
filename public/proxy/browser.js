const {ScramjetController}=$scramjetLoadController();
const scramjet=new ScramjetController({files:{wasm:'/scram/scramjet.wasm.wasm',all:'/scram/scramjet.all.js',sync:'/scram/scramjet.sync.js'}});
await scramjet.init();
const connection=new BareMux.BareMuxConnection('/baremux/worker.js');
const wispUrl=(location.protocol==='https:'?'wss':'ws')+'://'+location.host+'/wisp/';
await connection.setTransport('/epoxy/index.mjs',[{wisp:wispUrl}]);
await navigator.serviceWorker.ready;
await navigator.serviceWorker.ready;
const frame=scramjet.createFrame();
document.body.appendChild(frame.frame);
frame.frame.style.cssText='width:100vw;height:100vh;border:0;margin:0;padding:0;';
let current='https://example.com';
function go(url){current=url;frame.go(url);window.parent.postMessage({type:'proxy-urlchange',url},location.origin);}
window.addEventListener('message',(e)=>{if(e.origin!==location.origin)return;if(e.data?.type==='navigate')go(e.data.url);if(e.data?.type==='reload')go(current);});
go(current);