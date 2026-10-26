export const platforms = [
  {x:0,y:420,w:450,h:180},{x:540,y:420,w:300,h:180},
  {x:910,y:365,w:210,h:235},{x:1200,y:310,w:200,h:290},
  {x:1480,y:420,w:330,h:180},{x:1890,y:370,w:260,h:230},
  {x:2240,y:420,w:500,h:180}
];
export const spikes=[{x:680,y:420,w:65},{x:1590,y:420,w:75},{x:2000,y:370,w:60}];
export const gemLocations=[{x:610,y:350},{x:1290,y:240},{x:1940,y:300}];
export const spawn=()=>({x:90,y:370,vx:0,vy:0,w:24,h:50,grounded:false,coyote:0,buffer:0,facing:1});
export function step(p,dt,input){
  const direction=Number(Boolean(input.right))-Number(Boolean(input.left));
  p.vx+=(direction*255-p.vx)*Math.min(1,dt*(p.grounded?13:7));
  if(direction)p.facing=direction;
  p.coyote=p.grounded?0.11:Math.max(0,p.coyote-dt);
  p.buffer=input.jump?0.13:Math.max(0,p.buffer-dt);
  if(p.buffer>0&&p.coyote>0){p.vy=-535;p.grounded=false;p.coyote=0;p.buffer=0;}
  p.vy+=1350*dt;
  const oldBottom=p.y+p.h;
  p.x=Math.max(0,Math.min(2690,p.x+p.vx*dt));
  for(const b of platforms){if(p.y+p.h>b.y+5&&p.y<b.y+b.h&&p.x+p.w>b.x&&p.x<b.x+b.w){if(p.vx>0)p.x=b.x-p.w;else if(p.vx<0)p.x=b.x+b.w;p.vx=0;}}
  p.y+=p.vy*dt;p.grounded=false;
  for(const b of platforms){if(p.x+p.w>b.x&&p.x<b.x+b.w&&oldBottom<=b.y+1&&p.y+p.h>=b.y&&p.vy>=0){p.y=b.y-p.h;p.vy=0;p.grounded=true;}}
  return p.y>650||spikes.some(s=>p.x+p.w>s.x+5&&p.x<s.x+s.w-5&&p.y+p.h>s.y-15&&p.y<s.y);
}
