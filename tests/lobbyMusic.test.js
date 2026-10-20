import test from 'node:test';
import assert from 'node:assert/strict';
import {
 LOBBY_MUSIC_CHOICES,validMusicChoice,resolveLobbyTheme,
 getLobbyScore,getLobbyLoopSeconds,createLobbyMusic
} from '../src/lobbyMusic.js';
class Param{
 constructor(){this.value=0;this.events=[]}
 setValueAtTime(v,t){this.value=v;this.events.push(['set',t,v])}
 setTargetAtTime(v,t){this.value=v;this.events.push(['target',t,v])}
 exponentialRampToValueAtTime(v,t){this.value=v;this.events.push(['ramp',t,v])}
}
class AudioNode{
 constructor(){this.gain=new Param();this.frequency=new Param();this.stopped=false}
 connect(){}
 disconnect(){}
 start(){}
 stop(t){this.stopped=true;this.stopTime=t}
}
class Context{
 constructor(){this.currentTime=10;this.state='running';this.nodes=[]}
 createGain(){const n=new AudioNode();this.nodes.push(n);return n}
 createOscillator(){const n=new AudioNode();n.osc=true;this.nodes.push(n);return n}
}
test('five fully scored original 16-bar melodies with resolution and finite notes',()=>{
 assert.equal(LOBBY_MUSIC_CHOICES.length,6);
 for(const {id} of LOBBY_MUSIC_CHOICES.slice(1)){
   const s=getLobbyScore(id);
   assert.equal(s.melody.length,16);
   assert.equal(s.harmony.length,16);
   assert.ok(s.melody.every(b=>b.length>=3&&b.every(n=>n.position>=0&&n.position<8)));
   assert.ok(s.melody[15].length>0);
   assert.ok(getLobbyLoopSeconds(id)>30&&getLobbyLoopSeconds(id)<60);
 }
});
test('automatic dates, manual festival override, lunar festival not falsely pinned',()=>{
 const date=(m,d)=>new Date(2026,m-1,d);
 assert.equal(resolveLobbyTheme('auto',date(4,13)),'songkran');
 assert.equal(resolveLobbyTheme('auto',date(10,31)),'halloween');
 assert.equal(resolveLobbyTheme('auto',date(12,25)),'winter');
 assert.equal(resolveLobbyTheme('auto',date(1,1)),'winter');
 assert.equal(resolveLobbyTheme('auto',date(7,12)),'astral');
 assert.equal(resolveLobbyTheme('auto',date(11,25)),'astral');
 assert.equal(resolveLobbyTheme('auto',date(11,25),'lantern'),'lantern');
 assert.equal(resolveLobbyTheme('halloween',date(4,13),'songkran'),'halloween');
 assert.equal(validMusicChoice('unknown'),'auto');
});
test('AudioContext scheduler wraps twice, all note oscillators stop, and pause schedules nothing',()=>{
 const ctx=new Context(),music=createLobbyMusic({context:ctx,destination:new AudioNode()});
 music.update(true,'astral');
 assert.ok(ctx.nodes.some(n=>n.osc));
 const count=ctx.nodes.filter(n=>n.osc).length;
 const loop=getLobbyLoopSeconds('astral');
 for(let t=.08;t<loop*2.1;t+=.08){
   ctx.currentTime=10+t;music.update(true,'astral');
 }
 assert.ok(ctx.nodes.filter(n=>n.osc).length>count+400);
 assert.ok(ctx.nodes.filter(n=>n.osc).every(n=>n.stopped));
 music.update(false);
 const now=ctx.nodes.filter(n=>n.osc).length;
 ctx.currentTime+=.5;music.update(false);
 assert.equal(ctx.nodes.filter(n=>n.osc).length,now);
});
test('seasonal change waits until next bar and crossfades; resume starts the chosen score',()=>{
 const ctx=new Context(),music=createLobbyMusic({context:ctx,destination:new AudioNode()});
 music.update(true,'astral');
 for(let i=0;i<10;i++){ctx.currentTime+=.09;music.update(true,'astral')}
 music.update(true,'songkran');
 assert.equal(music.getTheme(),'astral');
 for(let i=0;i<80;i++){ctx.currentTime+=.09;music.update(true,'songkran')}
 assert.equal(music.getTheme(),'songkran');
 assert.ok(ctx.nodes.some(n=>n.gain.events.some(e=>e[0]==='target'&&e[2]===.0001)));
 music.update(false);
 music.update(true,'winter');
 assert.equal(music.getTheme(),'winter');
});
