// Composed for ARCANA SURVIVOR: five original melodic scores, no borrowed audio.
// 16 bars (128 eighth notes) per score. Audio is scheduled on AudioContext time.
export const LOBBY_MUSIC_CHOICES = Object.freeze([
  {id:'auto', label:'อัตโนมัติ'},
  {id:'astral', label:'Astral Reverie'},
  {id:'songkran', label:'Songkran • Waterlight'},
  {id:'lantern', label:'Lantern • Moonriver'},
  {id:'halloween', label:'Halloween • Veil'},
  {id:'winter', label:'Winter • Starlight'}
]);
const IDS = new Set(LOBBY_MUSIC_CHOICES.map(x=>x.id));
export const validMusicChoice = value => IDS.has(value) ? value : 'auto';
export function resolveLobbyTheme(choice='auto', date=new Date(), eventTheme=null) {
  choice=validMusicChoice(choice);
  if(choice!=='auto')return choice;
  if(IDS.has(eventTheme)&&eventTheme!=='auto')return eventTheme;
  // Device-local date; floating lunar festivals can be set by event/manual choice.
  const m=date.getMonth()+1,d=date.getDate();
  if(m===4&&d>=12&&d<=16)return 'songkran';
  if((m===10&&d>=25)||(m===11&&d===1))return 'halloween';
  if((m===12&&d>=15)||(m===1&&d<=5))return 'winter';
  return 'astral';
}
const parseMelody = bars => bars.split('|').map((bar,i)=>bar.trim().split(/\s+/).filter(Boolean).map(token=>{
  const [position,pitch,length]=token.split(':').map(Number);
  if(!Number.isInteger(position)||position<0||position>7||
     !Number.isInteger(pitch)||pitch<48||pitch>96||
     !Number.isInteger(length)||length<1||length>8)
    throw Error('Invalid composition at bar '+(i+1));
  return Object.freeze({position,pitch,length});
}));
function makeScore(bpm,harmony,phrase,timbre,arp){
  const melody=parseMelody(phrase.join('|'));
  if(melody.length!==16||harmony.length!==8)throw Error('Invalid 16-bar score');
  return Object.freeze({bpm,melody,harmony:[...harmony,...harmony].map(chord=>[...chord]),timbre,arp});
}
// A and B phrases make a recognisable 16-bar tune; the final dominant pickup
// leads back to the opening tonic without resetting the accompaniment.
const SCORES=Object.freeze({
 astral:makeScore(88,[
   [50,53,57,64],[46,53,57,62],[53,57,60,67],[48,55,58,62],
   [43,50,53,58],[46,53,57,60],[52,55,58,62],[45,52,55,60]
 ],[
  '0:74:3 3:77:1 4:76:2 6:72:2',
  '0:69:2 2:72:2 5:74:1 6:77:2',
  '0:79:3 3:77:1 4:76:2 6:72:2',
  '0:74:4 4:72:2 6:69:1 7:72:1',
  '0:77:2 2:79:2 4:81:2 7:79:1',
  '0:77:3 3:74:1 4:72:2 6:74:2',
  '0:76:2 2:74:2 5:72:1 6:70:2',
  '0:73:3 3:76:1 4:74:2 6:69:2',
  '0:81:2 2:79:1 3:77:1 4:76:3 7:74:1',
  '0:72:2 2:74:2 4:77:2 6:81:2',
  '0:79:2 2:81:2 4:84:2 7:79:1',
  '0:77:3 3:76:1 4:74:2 6:72:2',
  '0:70:2 2:74:2 4:77:3 7:79:1',
  '0:81:2 2:79:2 4:77:2 6:74:2',
  '0:72:3 3:70:1 4:69:2 6:73:2',
  '0:69:2 2:73:2 4:76:2 6:73:1 7:72:1'
 ],'glass',[0,2,1,3,2,1,0,2]),
 songkran:makeScore(108,[
  [50,54,57,64],[47,50,54,57],[43,47,50,57],[45,52,54,57],
  [50,54,57,61],[43,47,50,59],[47,50,54,57],[45,52,54,61]
 ],[
  '0:78:1 1:81:2 4:83:1 5:81:1 7:78:1',
  '0:76:2 2:74:1 3:78:1 5:81:2 7:83:1',
  '0:86:1 2:83:2 4:81:1 5:78:2 7:76:1',
  '0:74:2 3:78:1 4:81:2 6:76:2',
  '0:81:1 1:83:1 3:86:2 5:83:1 6:81:2',
  '0:78:2 2:81:1 4:83:2 6:78:2',
  '0:76:1 1:78:1 3:81:1 4:86:2 7:83:1',
  '0:81:2 2:78:2 4:76:2 6:73:2',
  '0:86:2 2:83:1 3:81:1 4:78:2 7:81:1',
  '0:83:1 1:86:1 3:88:2 5:86:1 7:83:1',
  '0:81:2 2:78:1 3:76:1 4:74:2 6:78:2',
  '0:81:1 2:83:2 5:86:1 6:83:2',
  '0:90:1 1:86:1 3:83:2 5:81:1 7:78:1',
  '0:76:2 2:78:2 4:81:2 6:86:2',
  '0:83:2 3:81:1 4:78:1 6:76:2',
  '0:73:2 2:76:2 4:78:1 5:81:1 7:73:1'
 ],'water',[0,2,3,1,2,0,3,1]),
 lantern:makeScore(80,[
  [43,47,50,57],[47,50,55,59],[48,52,55,59],[45,50,52,57],
  [43,47,50,57],[52,55,59,64],[48,52,55,59],[50,54,57,60]
 ],[
  '0:79:4 4:83:2 6:81:2',
  '0:79:2 2:74:3 6:76:2',
  '0:79:3 3:81:1 4:83:3 7:86:1',
  '0:83:4 4:81:2 6:79:2',
  '0:86:3 3:83:2 5:81:2',
  '0:79:2 2:83:2 4:86:3',
  '0:88:2 3:86:1 4:83:2 6:81:2',
  '0:78:3 3:81:2 6:79:2',
  '0:83:2 2:86:2 4:88:4',
  '0:86:3 3:83:1 4:81:2 6:79:2',
  '0:76:2 2:79:2 4:83:3',
  '0:81:4 5:83:1 6:86:2',
  '0:91:2 2:88:2 4:86:2 6:83:2',
  '0:81:2 2:83:3 5:79:2',
  '0:76:2 2:79:2 4:81:2 6:83:2',
  '0:78:2 2:81:2 4:79:2 7:78:1'
 ],'soft',[0,1,2,3,1,2,0,3]),
 halloween:makeScore(94,[
  [50,51,57,60],[46,50,53,58],[51,55,58,62],[45,51,52,57],
  [50,53,57,63],[46,51,53,58],[48,51,55,60],[45,49,52,55]
 ],[
  '0:74:2 2:75:1 3:74:1 5:70:2',
  '0:69:1 1:70:1 3:74:2 5:75:1 7:77:1',
  '0:79:3 3:75:1 4:74:2 7:70:1',
  '0:73:2 2:74:1 4:77:1 5:75:2',
  '0:82:2 3:81:1 4:79:1 6:75:2',
  '0:74:3 3:70:1 4:75:2 7:77:1',
  '0:79:1 2:82:1 3:79:1 5:75:2',
  '0:73:2 2:70:2 4:69:2 7:73:1',
  '0:86:1 1:82:1 3:79:2 6:75:2',
  '0:74:1 1:75:1 2:74:1 4:70:3',
  '0:77:2 2:79:1 3:82:1 5:79:2',
  '0:75:2 2:73:2 4:75:1 6:77:2',
  '0:82:1 2:86:1 3:82:1 5:79:2',
  '0:77:2 2:75:1 4:74:2 6:70:2',
  '0:72:2 3:75:1 4:77:2 6:73:2',
  '0:69:2 2:73:2 5:75:1 7:73:1'
 ],'shadow',[0,1,2,0,3,2,1,3]),
 winter:makeScore(92,[
  [48,52,55,59],[50,54,57,61],[52,55,59,62],[47,50,54,59],
  [45,52,55,60],[53,57,60,64],[50,54,57,61],[55,59,62,65]
 ],[
  '0:76:2 2:79:2 4:83:3',
  '0:81:1 1:78:1 3:76:2 5:74:2',
  '0:79:3 3:83:2 6:86:2',
  '0:78:2 2:79:1 4:83:3',
  '0:81:2 2:83:2 4:88:2 7:86:1',
  '0:84:3 3:81:1 4:79:2 6:76:2',
  '0:78:2 2:81:2 4:83:2 6:86:2',
  '0:83:4 4:79:2 6:78:2',
  '0:88:2 2:86:1 3:83:1 4:81:3',
  '0:78:2 2:81:2 4:86:2 7:88:1',
  '0:91:2 2:88:2 4:86:3',
  '0:83:2 2:79:2 4:78:1 6:76:2',
  '0:81:2 2:84:2 4:88:2 6:91:2',
  '0:88:3 3:84:1 4:81:2 6:79:2',
  '0:83:2 2:86:2 4:81:2 6:78:2',
  '0:79:2 2:78:2 4:83:2 7:71:1'
 ],'ice',[0,2,1,3,0,2,3,1])
});
export const getLobbyScore=theme=>SCORES[theme]||SCORES.astral;
export const getLobbyLoopSeconds=theme=>64*60/getLobbyScore(theme).bpm;
const midiHz=n=>440*2**((n-69)/12);

export function createLobbyMusic({context,destination}) {
  let running=false, theme=null, wanted=null, tick=0, nextAt=0, channel=null;
  const stale=[];
  function makeBus(at) {
    const g=context.createGain();
    g.gain.setValueAtTime(.0001,at);
    g.gain.setTargetAtTime(.72,at+.01,.18);
    g.connect(destination);return g;
  }
  function fade(at) {
    if(!channel)return;
    channel.gain.setTargetAtTime(.0001,at,.19);
    stale.push({bus:channel,until:at+3.4});
    channel=null;
  }
  function clean() {
    for(let i=stale.length-1;i>=0;i--)if(stale[i].until<context.currentTime){
      stale[i].bus.disconnect?.();stale.splice(i,1);
    }
  }
  function playNote(at,pitch,duration,level,wave) {
    const osc=context.createOscillator(),g=context.createGain();
    osc.type=wave;
    osc.frequency.setValueAtTime(midiHz(pitch),at);
    const attack=Math.min(.035,duration*.17);
    g.gain.setValueAtTime(.0001,at);
    g.gain.exponentialRampToValueAtTime(level,at+attack);
    g.gain.setValueAtTime(level*.66,at+Math.max(attack,duration*.36));
    g.gain.exponentialRampToValueAtTime(.0001,at+duration);
    osc.connect(g);g.connect(channel);
    osc.start(at);osc.stop(at+duration+.035);
  }
  function playSlot(score,slotNumber,at) {
    const slot=slotNumber%8,bar=Math.floor(slotNumber/8);
    const eighth=30/score.bpm,chord=score.harmony[bar],root=chord[0];
    if(slot===0){
      playNote(at,root-12,eighth*5,.045,'sine');
      for(const pitch of chord.slice(1))
        playNote(at,pitch+12,eighth*8.35,score.timbre==='shadow'?.016:.022,'sine');
    }
    if(slot===4)playNote(at,root-12,eighth*2.8,.028,'sine');
    if((slot%2===0&&score.timbre!=='soft')||slot===2||slot===6){
      playNote(at,chord[score.arp[slot]]+24,
        eighth*(score.timbre==='water'?.62:1.28),
        score.timbre==='water'?.033:.019,
        score.timbre==='shadow'?'triangle':'sine');
    }
    for(const n of score.melody[bar])if(n.position===slot){
      const dur=eighth*n.length*(score.timbre==='water'?.83:.96);
      playNote(at,n.pitch,dur,score.timbre==='shadow'?.076:.070,
        score.timbre==='water'||score.timbre==='shadow'?'triangle':'sine');
      if(n.length>=2&&score.timbre!=='shadow')
        playNote(at,n.pitch+12,dur*.72,score.timbre==='ice'?.014:.009,'sine');
    }
  }
  function startTheme(newTheme,at){
    fade(at);theme=newTheme;channel=makeBus(at);tick=0;nextAt=at;
  }
  function update(play,requestedTheme='astral'){
    clean();
    if(!play||context.state!=='running'){
      if(running)fade(context.currentTime);
      running=false;nextAt=0;return;
    }
    wanted=SCORES[requestedTheme]?requestedTheme:'astral';
    if(!running){running=true;startTheme(wanted,context.currentTime+.035);}
    let guard=0;
    while(nextAt<context.currentTime+.13&&guard++<3){
      if(wanted!==theme&&tick%8===0)startTheme(wanted,nextAt);
      const score=getLobbyScore(theme);
      playSlot(score,tick,nextAt);
      tick=(tick+1)%128;
      nextAt+=30/score.bpm;
    }
  }
  return {update,getTheme:()=>theme,getStep:()=>tick};
}
