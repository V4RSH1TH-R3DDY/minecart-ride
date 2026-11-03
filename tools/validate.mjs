import { buildTrack } from '../src/track.js';
const t = buildTrack();
const c = t.cells;
console.log('cells', c.length, 'length', t.total.toFixed(1));
let minx=1e9,maxx=-1e9,minz=1e9,maxz=-1e9,miny=1e9,maxy=-1e9;
for (const k of c){minx=Math.min(minx,k.x);maxx=Math.max(maxx,k.x);minz=Math.min(minz,k.z);maxz=Math.max(maxz,k.z);miny=Math.min(miny,k.yb);maxy=Math.max(maxy,k.yb);}
console.log('bbox x',minx,maxx,'z',minz,maxz,'y',miny,maxy);
t.legs.forEach((l,i)=>console.log('leg',i,'len',(l.toS-l.fromS).toFixed(1),'brake',(l.toS-l.brakeS).toFixed(1)));
let bad=0;
for (let i=0;i<c.length;i++) for (let j=i+12;j<c.length;j++){ const near=Math.max(Math.abs(c[i].x-c[j].x),Math.abs(c[i].z-c[j].z)); if (j-i<40 && near>=3) continue;
  const a=c[i],b=c[j];
  if (Math.max(Math.abs(a.x-b.x),Math.abs(a.z-b.z))<=8 && Math.abs(a.yb-b.yb)<11){ if(bad<15) console.log('conflict',i,j,a.x,a.z,a.yb,b.x,b.z,b.yb); bad++; }
}
console.log('conflicts',bad);
t.stops.forEach((s,i)=>console.log('stop',i,'cell',s.i,s.x,s.z,s.yb));
