const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const $ = id => document.getElementById(id);

const ui = {
  health: $('healthFill'), level: $('levelText'), level2: $('levelText2'),
  xp: $('xpText'), coins: $('coinText'), gems: $('gemText'), weapon: $('weaponText'),
  lives: $('livesText'), power: $('powerText'), overlay: $('overlay'), title: $('overlayTitle'),
  text: $('overlayText'), quests: $('questList'), xpFill: $('xpFill')
};

const W = canvas.width, H = canvas.height;
const GR = 0.72;
const weapons = ['blaster', 'spread', 'laser', 'bomb', 'rapid'];
const weaponName = { blaster:'BLASTER', spread:'SPREAD', laser:'LASER', bomb:'BOMB', rapid:'RAPID' };
const input = { left:false, right:false, jump:false, fire:false, dash:false, up:false, down:false };

const enemyDefs = {
  walker:{hp:1,speed:1.1,color:'#7cbd62',score:50,xp:12},
  flyer:{hp:2,speed:1.0,color:'#9d75d6',score:80,xp:18},
  shooter:{hp:3,speed:0.7,color:'#e0a33b',score:110,xp:25},
  tank:{hp:6,speed:0.45,color:'#6e8399',score:180,xp:40},
  charger:{hp:3,speed:1.6,color:'#db5b5b',score:140,xp:30},
  boss:{hp:25,speed:0.8,color:'#cf4c7a',score:1000,xp:180}
};

const palettes = [
  ['#7ba46d','#a9c77b'],['#5d8cc7','#a8d9ed'],['#7866a8','#e5a06b'],['#3e7c89','#7ad1bd'],
  ['#8f4b37','#e7a14a'],['#435b93','#a9d5ff'],['#34374d','#9a91b8'],['#7b4c88','#e8a1d3'],
  ['#3e6e57','#b7d46e'],['#8b6a35','#e7ca65'],['#3e4d70','#8bc4e8'],['#5b3038','#d96969']
];

const levelNames = [
  'Meadow Gate','Cloud Climb','Moonlit Castle','Crystal Caves','Volcano Run','Sky Fortress',
  'Shadow Factory','Mushroom Marsh','Frost Kingdom','Golden Ruins','Star Temple','Demon Citadel'
];

const quests = [
  {id:'coins',label:'Coin Collector',target:8,reward:120},
  {id:'kills',label:'Bug Hunter',target:5,reward:150},
  {id:'gems',label:'Gem Seeker',target:2,reward:180},
  {id:'power',label:'Power Up!',target:1,reward:100},
  {id:'finish',label:'Reach the Flag',target:1,reward:200}
];

let game = null;
let raf = 0;
let last = performance.now();
let audioCtx = null;

function beep(freq=440,duration=0.05){
  try{
    if(!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if(audioCtx.state==='suspended') audioCtx.resume();
    const osc=audioCtx.createOscillator(), gain=audioCtx.createGain();
    osc.frequency.value=freq; osc.type='square'; gain.gain.value=0.04;
    osc.connect(gain); gain.connect(audioCtx.destination); osc.start();
    osc.stop(audioCtx.currentTime+duration);
  }catch(e){}
}

function groundSegments(width,n){
  const gap = n % 3 === 0 ? 55 : 75;
  return [
    [0,492,760,60],
    [760+gap,492,650,60],
    [1410+gap,492,width-(1410+gap),60]
  ].filter(r=>r[2]>0);
}

function makeLevel(n){
  const width = 2500 + n*170;
  const platforms = groundSegments(width,n);
  const heights = [410,350,390,320,375,305,395,340,380,315,400,350];

  // Main raised routes with varied spacing and sizes.
  for(let i=0;i<14+n%5;i++){
    const x=190+i*185+(n%3)*20;
    const y=heights[(i+n)%heights.length]-(Math.floor(i/7)%2)*12;
    const w=120+(i%4)*24;
    if(x+w<width-120) platforms.push([x,y,w,22]);
  }

  // Stepping stones around the major gaps.
  for(const r of [[690,450,90,20],[805,425,100,20],[1375,450,90,20],[1490,425,100,20],[2140,450,95,20]]){
    if(r[0]+r[2]<width) platforms.push(r);
  }

  const coins=[];
  for(let i=0;i<14+n%5;i++){
    const x=145+i*175;
    const y= i%4===0 ? 445 : 285+(i%4)*35;
    if(x<width-120) coins.push([x,y]);
  }

  const gems=[];
  for(let i=0;i<3+n%3;i++){
    const x=500+i*600;
    if(x<width-150) gems.push([x,420-(i%2)*80]);
  }

  const powerups=[];
  const unlockByLevel={1:'spread',2:'laser',3:'bomb',4:'rapid'};
  const unlock=unlockByLevel[n];
  if(unlock){
    const spots={spread:[500,315],laser:[1120,285],bomb:[1780,300],rapid:[2350,295]};
    const s=spots[unlock];
    if(s && s[0]<width-100) powerups.push({x:s[0],y:s[1],type:unlock,got:false});
  }
  powerups.push({x:Math.min(1650+n*18,width-300),y:445,type:n%2?'shield':'heart',got:false});

  // Enemy creation.
  const enemies=[];
  const types=['walker','walker','flyer','shooter','charger','tank'];
  for(let i=0;i<7+n%4;i++){
    const type=types[(i+n)%types.length], d=enemyDefs[type];
    const x=360+i*335;
    const e={x,y:456,w:38,h:38,hp:d.hp,maxHp:d.hp,vx:d.speed,min:0,max:0,type,score:d.score,xp:d.xp,phase:i*1.7,dead:false};
    if(type==='flyer'){
      e.baseY=185+(i%3)*45;
      e.y=e.baseY;
      e.w=40;e.h=32;
      e.min=Math.max(100,x-150);
      e.max=Math.min(width-100,x+190);
      e.vx=(i%2===0?1:-1)*d.speed;
    }
    enemies.push(e);
  }

  // Put ground enemies on suitable platforms and give them real patrol ranges.
  const groundPlatforms=platforms.filter(r=>r[3]>=20 && r[2]>=90 && r[1]<=492);
  const usable=groundPlatforms.length ? groundPlatforms : [platforms[0]];
  let pi=0;
  for(const e of enemies){
    if(e.type==='flyer') continue;
    const r=usable[(pi++)%usable.length];
    const min=r[0]+12;
    const max=r[0]+r[2]-e.w-12;
    const range=Math.max(24,max-min);
    e.min=min;
    e.max=Math.max(min+24,max);
    e.x=min+((pi*47)%range);
    if(e.x>e.max)e.x=e.max;
    e.y=r[1]-e.h;
    e.vx=(pi%2===0?1:-1)*enemyDefs[e.type].speed;
    e.platformY=r[1];
  }

  if(n===11){
    const d=enemyDefs.boss;
    const r=platforms[platforms.length-1] || platforms[0];
    const min=Math.max(r[0]+20,width-650);
    const max=Math.max(min+30,Math.min(r[0]+r[2]-72-20,width-140));
    enemies.push({x:min+30,y:r[1]-72,w:72,h:72,hp:d.hp,maxHp:d.hp,vx:-d.speed,min,max,type:'boss',score:d.score,xp:d.xp,phase:0,dead:false,platformY:r[1]});
  }

  // Richer environmental set for each level.
  const decor={
    hills:[],trees:[],rocks:[],clouds:[],pillars:[],lights:[]
  };
  for(let x=0,i=0;x<width;x+=260,i++)decor.hills.push({x,y:300+(i%3)*18,w:220,h:120+(i%2)*30});
  for(let x=90,i=0;x<width;x+=360,i++)decor.trees.push({x,y:492-(i%2)*4,scale:0.75+(i%3)*0.18});
  for(let x=170,i=0;x<width;x+=290,i++)decor.rocks.push({x,y:470-(i%3)*6,w:35+(i%2)*16,h:22+(i%2)*10});
  for(let x=80,i=0;x<width;x+=420,i++)decor.clouds.push({x,y:90+(i%4)*34,w:90+(i%3)*35});
  if(n>=2)for(let x=260,i=0;x<width;x+=520,i++)decor.pillars.push({x,y:492,h:65+(i%3)*30});
  if(n>=4)for(let x=430;x<width;x+=610)decor.lights.push({x,y:280+(x%2)*55});

  return {n,name:levelNames[n],width,sky:palettes[n],platforms,coins,gems,powerups,enemies,decor,flag:{x:width-90,y:492}};
}

function freshGame(n=0){
  const old=game&&game.profile ? game.profile : null;
  const profile=old || {level:1,xp:0,coins:0,gems:0,totalKills:0,weapon:'blaster',unlockedWeapons:['blaster'],maxHp:5,hp:5,damage:1,speed:6.2};
  if(!Array.isArray(profile.unlockedWeapons)) profile.unlockedWeapons=['blaster'];
  if(!profile.unlockedWeapons.includes('blaster')) profile.unlockedWeapons.unshift('blaster');
  profile.unlockedWeapons=[...new Set(profile.unlockedWeapons.filter(w=>weapons.includes(w)))];
  profile.weapon=profile.unlockedWeapons.includes(profile.weapon)?profile.weapon:'blaster';
  const lvl=makeLevel(n),spawnPlatform=lvl.platforms[0];
  return {n,lvl,profile,cam:0,state:'playing',score:game&&Number.isFinite(game.score)?game.score:0,bullets:[],enemyBullets:[],particles:[],power:null,powerTimer:0,inv:0,dash:0,spawn:{x:80,y:spawnPlatform[1]-42},player:{x:80,y:spawnPlatform[1]-42,w:38,h:42,vx:0,vy:0,jumpCount:0,jumpHeld:false,fireLock:false},quest:quests.map(q=>({...q,progress:0,done:false})),time:0};
}

function xpNeed(){return 100+(game.profile.level-1)*70;}
function addXP(value){
  if(!game||!Number.isFinite(value))return;
  const p=game.profile;p.xp+=value;
  while(p.xp>=xpNeed()){
    p.xp-=xpNeed();p.level++;p.maxHp++;p.hp=p.maxHp;p.damage+=0.35;
    showOverlay('LEVEL UP!',`Level ${p.level}! HP, damage and movement speed increased.`,'CONTINUE');
    beep(760,0.16);
  }
}

function setPower(type){
  if(!game)return;
  if(type==='heart'){game.profile.hp=Math.min(game.profile.maxHp,game.profile.hp+2);game.power=null;game.powerTimer=0;return;}
  if(type==='shield'){game.power='shield';game.powerTimer=600;return;}
  if(weapons.includes(type)){
    if(!game.profile.unlockedWeapons.includes(type))game.profile.unlockedWeapons.push(type);
    game.profile.weapon=type;game.power=type;game.powerTimer=600;
  }
}
function cycleWeapon(){
  if(!game)return;
  const list=game.profile.unlockedWeapons.filter(w=>weapons.includes(w));
  const i=Math.max(0,list.indexOf(game.profile.weapon));
  game.profile.weapon=list[(i+1)%list.length];updateHUD();beep(620,0.05);
}
function updateQuest(id,amount=1){
  if(!game)return;const q=game.quest.find(q=>q.id===id);if(!q||q.done)return;
  q.progress=Math.min(q.target,q.progress+amount);
  if(q.progress>=q.target){q.done=true;game.score+=q.reward;addXP(q.reward/2);beep(900,0.1);}
}
function showOverlay(title,text,button='START GAME'){ui.title.textContent=title;ui.text.textContent=text;const b=$('startBtn');if(b)b.textContent=button;ui.overlay.classList.remove('hidden');}
function hideOverlay(){ui.overlay.classList.add('hidden');}
function start(n=0){game=freshGame(n);hideOverlay();last=performance.now();if(!raf)raf=requestAnimationFrame(loop);updateHUD();}
function restart(){start(game&&game.n!=null?game.n:0);}
function rectHit(a,b){return a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;}
function completeLevel(){if(!game||game.state!=='playing')return;updateQuest('finish');addXP(120);if(game.n<11){game.state='between';showOverlay(`LEVEL ${game.n+1} CLEAR!`,`Next: ${levelNames[game.n+1]}. Quests and XP carry over.`,'NEXT LEVEL');}else{game.state='win';showOverlay('YOU WIN!','All 12 levels cleared!','PLAY AGAIN');}}

function spawnBullet(){
  if(!game)return;const w=game.profile.weapon,p=game.player,x=p.x+p.w,y=p.y+14;
  let shots=w==='spread'?[{dx:8,dy:-2},{dx:8,dy:0},{dx:8,dy:2}]:[{dx:10,dy:0}];
  if(w==='laser')shots=[{dx:16,dy:0}];if(w==='bomb')shots=[{dx:7,dy:-1,bomb:true}];
  for(const s of shots)game.bullets.push({x,y,vx:s.dx,vy:s.dy,w:w==='laser'?34:12,h:6,damage:w==='laser'?3:game.profile.damage,bomb:!!s.bomb,life:80});
  beep(w==='laser'?880:520,0.035);
}
function hurt(d=1){
  if(!game||game.inv>0||game.power==='shield')return;
  game.profile.hp-=d;game.inv=70;beep(150,0.12);
  if(game.profile.hp<=0){game.profile.hp=game.profile.maxHp;game.score=Math.max(0,game.score-100);game.player.x=game.spawn.x;game.player.y=game.spawn.y;game.player.vx=0;game.player.vy=0;game.player.jumpCount=0;game.cam=0;}
}
function killEnemy(e){
  if(!game||!e||e.dead)return;e.dead=true;game.score+=e.score||0;game.profile.totalKills++;addXP(e.xp||0);updateQuest('kills');
  for(let i=0;i<8;i++)game.particles.push({x:e.x+e.w/2,y:e.y+e.h/2,vx:(Math.random()-.5)*4,vy:(Math.random()-.8)*4,life:30});
}
function onGround(p,L){
  const bottom=p.y+p.h;
  for(const r of L.platforms)if(p.x+p.w>r[0]+2&&p.x<r[0]+r[2]-2&&Math.abs(bottom-r[1])<=3&&p.vy>=0)return r;
  return null;
}

function update(dt){
  if(!game||game.state!=='playing')return;
  game.time+=dt;const p=game.player,L=game.lvl;
  const jumpPressed=input.jump&&!p.jumpHeld;p.jumpHeld=input.jump;
  const ground=onGround(p,L);
  if(ground){p.y=ground[1]-p.h;p.vy=0;p.jumpCount=0;}
  if(input.left&&!input.right)p.vx=-game.profile.speed;else if(input.right&&!input.left)p.vx=game.profile.speed;else if(!input.left&&!input.right)p.vx*=0.78;else p.vx=0;
  p.vx=Math.max(-game.profile.speed,Math.min(game.profile.speed,p.vx));
  if(jumpPressed&&p.jumpCount<2){p.vy=-11;p.jumpCount++;}
  if(input.dash&&game.dash<=0){p.vx=(p.vx<0?-1:1)*12;game.dash=55;game.inv=20;}
  game.dash=Math.max(0,game.dash-dt);
  p.vy+=GR;p.x+=p.vx;p.y+=p.vy;p.x=Math.max(0,Math.min(L.width-p.w,p.x));
  if(p.vy>=0){for(const r of L.platforms){const oldBottom=p.y+p.h-p.vy,newBottom=p.y+p.h;if(p.x+p.w>r[0]&&p.x<r[0]+r[2]&&oldBottom<=r[1]+2&&newBottom>=r[1]&&newBottom<=r[1]+14){p.y=r[1]-p.h;p.vy=0;p.jumpCount=0;break;}}}
  if(p.y>H+100){hurt(1);p.x=game.spawn.x;p.y=game.spawn.y;p.vx=0;p.vy=0;p.jumpCount=0;}
  if(input.fire&&!p.fireLock){spawnBullet();p.fireLock=true;}if(!input.fire)p.fireLock=false;
  if(game.profile.weapon==='rapid'&&input.fire&&Math.random()<0.18)spawnBullet();

  for(const b of game.bullets){b.x+=b.vx;b.y+=b.vy;b.life--;for(const e of L.enemies)if(!e.dead&&rectHit(b,e)){e.hp-=b.damage;b.life=0;if(e.hp<=0)killEnemy(e);break;}}
  game.bullets=game.bullets.filter(b=>b.life>0&&b.x<L.width+120);

  for(const e of L.enemies){
    if(e.dead)continue;
    if(e.type==='flyer'){
      e.x+=e.vx*dt;
      if(e.x<=e.min){e.x=e.min;e.vx=Math.abs(enemyDefs.flyer.speed);}
      else if(e.x>=e.max){e.x=e.max;e.vx=-Math.abs(enemyDefs.flyer.speed);}
      e.y=e.baseY+Math.sin(game.time*0.035+e.phase)*24;
      e.y=Math.max(120,Math.min(340,e.y));
    }else{
      // Ground enemies patrol continuously across a real platform range.
      if(!Number.isFinite(e.vx)||Math.abs(e.vx)<0.05)e.vx=enemyDefs[e.type].speed;
      e.x+=e.vx*dt;
      if(e.x<=e.min){e.x=e.min;e.vx=Math.abs(enemyDefs[e.type].speed);}
      else if(e.x>=e.max){e.x=e.max;e.vx=-Math.abs(enemyDefs[e.type].speed);}
      if(e.type==='charger'&&Math.abs(p.x-e.x)<220)e.vx=p.x<e.x?-Math.abs(2.4):Math.abs(2.4);
      if(Number.isFinite(e.platformY))e.y=e.platformY-e.h;
    }
    if(e.type==='shooter'&&Math.random()<0.012)game.enemyBullets.push({x:e.x,y:e.y+12,vx:p.x<e.x?-4:4,vy:0,w:10,h:5});
    if(e.type==='boss'&&Math.random()<0.025)for(let a=-1;a<=1;a++)game.enemyBullets.push({x:e.x,y:e.y,vx:a*3,vy:-2,w:12,h:7});
    if(rectHit(p,e))hurt(e.type==='boss'?2:1);
  }

  for(const b of game.enemyBullets){b.x+=b.vx*dt;b.y+=b.vy*dt;if(rectHit(b,p)){b.x=-9999;hurt(1);}}
  game.enemyBullets=game.enemyBullets.filter(b=>b.x>-500&&b.x<L.width+500);
  for(const c of L.coins)if(!c.got&&Math.hypot(p.x-c[0],p.y-c[1])<38){c.got=true;game.profile.coins++;game.score+=10;addXP(5);updateQuest('coins');beep(700,0.03);}
  for(const g of L.gems)if(!g.got&&Math.hypot(p.x-g[0],p.y-g[1])<38){g.got=true;game.profile.gems++;game.score+=50;addXP(20);updateQuest('gems');beep(980,0.05);}
  for(const pu of L.powerups)if(!pu.got&&Math.hypot(p.x-pu.x,p.y-pu.y)<42){pu.got=true;setPower(pu.type);updateQuest('power');beep(820,0.08);}
  if(game.powerTimer>0){game.powerTimer-=dt;if(game.powerTimer<=0)game.power=null;}
  if(Math.abs(p.x-L.flag.x)<48){completeLevel();return;}
  game.cam=Math.max(0,Math.min(L.width-W,p.x-W*0.38));game.inv=Math.max(0,game.inv-dt);updateHUD();
}

function drawCharacter(p){
  ctx.save();ctx.globalAlpha=game.inv%8<4?0.45:1;
  ctx.fillStyle='#26313b';ctx.fillRect(p.x+6,p.y+31,10,11);ctx.fillRect(p.x+23,p.y+31,10,11);
  ctx.fillStyle='#3f78bd';ctx.fillRect(p.x+5,p.y+18,29,16);
  ctx.fillStyle='#f2bd88';ctx.fillRect(p.x+8,p.y+7,22,15);
  ctx.fillStyle='#d84d55';ctx.fillRect(p.x+6,p.y+4,27,7);ctx.fillRect(p.x+13,p.y+1,13,5);
  ctx.fillStyle='#111';ctx.fillRect(p.x+13,p.y+12,3,3);ctx.fillRect(p.x+23,p.y+12,3,3);
  ctx.fillStyle='#f2bd88';ctx.fillRect(p.x+1,p.y+20,6,10);ctx.fillRect(p.x+32,p.y+20,6,10);
  ctx.restore();
}
function drawEnemy(e){
  const c=enemyDefs[e.type].color;ctx.fillStyle=c;
  if(e.type==='flyer'){ctx.beginPath();ctx.arc(e.x+e.w/2,e.y+e.h/2,e.w/2,0,Math.PI*2);ctx.fill();ctx.fillStyle='#efe9ff';ctx.fillRect(e.x-8,e.y+10,11,7);ctx.fillRect(e.x+e.w-3,e.y+10,11,7);}
  else if(e.type==='tank'||e.type==='boss'){ctx.fillRect(e.x,e.y+7,e.w,e.h-7);ctx.fillStyle='#aeb9c5';ctx.fillRect(e.x+6,e.y,e.w-12,9);}
  else if(e.type==='charger'){ctx.beginPath();ctx.moveTo(e.x+e.w/2,e.y);ctx.lineTo(e.x+e.w,e.y+e.h);ctx.lineTo(e.x,e.y+e.h);ctx.closePath();ctx.fill();}
  else{ctx.fillRect(e.x+3,e.y+5,e.w-6,e.h-5);}
  ctx.fillStyle='#111';ctx.fillRect(e.x+8,e.y+12,5,5);ctx.fillRect(e.x+e.w-13,e.y+12,5,5);
  if(e.type==='boss'){ctx.fillStyle='#ffdf64';ctx.fillRect(e.x,e.y-12,Math.max(0,e.hp/e.maxHp*e.w),5);}
}

function draw(){
  ctx.clearRect(0,0,W,H);if(!game)return;const L=game.lvl;
  const gradient=ctx.createLinearGradient(0,0,0,H);gradient.addColorStop(0,L.sky[0]);gradient.addColorStop(1,L.sky[1]);ctx.fillStyle=gradient;ctx.fillRect(0,0,W,H);
  ctx.save();ctx.translate(-game.cam,0);

  // Layered background mountains create depth and make each map feel larger.
  if(L.decor){
    for(const h of L.decor.hills){ctx.fillStyle='#263d3b55';ctx.beginPath();ctx.moveTo(h.x,h.y+h.h);ctx.quadraticCurveTo(h.x+h.w*.5,h.y-h.h*.35,h.x+h.w,h.y+h.h);ctx.closePath();ctx.fill();}
    for(const c of L.decor.clouds){ctx.fillStyle='#ffffff28';ctx.beginPath();ctx.arc(c.x,c.y,18,0,Math.PI*2);ctx.arc(c.x+25,c.y-9,24,0,Math.PI*2);ctx.arc(c.x+55,c.y,17,0,Math.PI*2);ctx.fill();}
    for(const t of L.decor.trees){const s=t.scale;ctx.fillStyle='#4d3327';ctx.fillRect(t.x-5*s,t.y-48*s,10*s,48*s);ctx.fillStyle='#355e3d';ctx.beginPath();ctx.arc(t.x,t.y-58*s,28*s,0,Math.PI*2);ctx.arc(t.x-20*s,t.y-45*s,20*s,0,Math.PI*2);ctx.arc(t.x+20*s,t.y-45*s,20*s,0,Math.PI*2);ctx.fill();}
    for(const r of L.decor.rocks){ctx.fillStyle='#46545a';ctx.fillRect(r.x,r.y-r.h,r.w,r.h);ctx.fillStyle='#69787c';ctx.fillRect(r.x+7,r.y-r.h,r.w*.35,5);}
    for(const p of L.decor.pillars){ctx.fillStyle='#39464c';ctx.fillRect(p.x,p.y-p.h,38,p.h);ctx.fillStyle='#68767b';ctx.fillRect(p.x-7,p.y-p.h,52,8);}
    for(const l of L.decor.lights){ctx.fillStyle='#4b3b2a';ctx.fillRect(l.x,l.y,5,45);ctx.fillStyle='#f4d86a';ctx.beginPath();ctx.arc(l.x+2,l.y,8,0,Math.PI*2);ctx.fill();}
  }

  // Platform terrain has darker soil, grass tops, and occasional stone blocks.
  for(const r of L.platforms){
    ctx.fillStyle='#28352c';ctx.fillRect(r[0],r[1],r[2],r[3]);
    ctx.fillStyle='#91c05e';ctx.fillRect(r[0],r[1],r[2],6);
    ctx.fillStyle='#34473a';
    for(let x=r[0]+12;x<r[0]+r[2]-8;x+=32)ctx.fillRect(x,r[1]+12,18,5);
  }

  // Level-specific hazards/details without making the route impossible.
  if(L.n>=4){
    for(let x=180;x<L.width;x+=430){ctx.fillStyle=L.n>=8?'#b9d9ff':'#e66b3d';ctx.fillRect(x,478,70,7);for(let i=0;i<7;i++)ctx.fillRect(x+i*10,472-(i%2)*3,7,6);}
  }
  if(L.n>=6){
    for(let x=320;x<L.width;x+=570){ctx.fillStyle='#59636b';ctx.fillRect(x,440,8,52);ctx.fillRect(x-10,438,28,7);}
  }

  for(const c of L.coins){if(c.got)continue;ctx.fillStyle='#f5d44e';ctx.beginPath();ctx.arc(c[0],c[1],10,0,Math.PI*2);ctx.fill();ctx.fillStyle='#fff3a0';ctx.fillRect(c[0]-2,c[1]-6,4,12);}
  for(const g of L.gems){if(g.got)continue;ctx.fillStyle='#72e8ff';ctx.beginPath();ctx.moveTo(g[0],g[1]-12);ctx.lineTo(g[0]+9,g[1]);ctx.lineTo(g[0],g[1]+12);ctx.lineTo(g[0]-9,g[1]);ctx.fill();}
  for(const pu of L.powerups){if(pu.got)continue;ctx.fillStyle=pu.type==='shield'?'#65c7ff':pu.type==='heart'?'#ff6a76':'#f2cf51';ctx.fillRect(pu.x-13,pu.y-13,26,26);ctx.fillStyle='#18202a';ctx.font='bold 15px sans-serif';ctx.textAlign='center';ctx.fillText(pu.type==='heart'?'♥':pu.type==='shield'?'◆':String(pu.type).charAt(0).toUpperCase(),pu.x,pu.y+5);}
  for(const e of L.enemies)if(!e.dead)drawEnemy(e);

  ctx.fillStyle='#e9e2a0';ctx.fillRect(L.flag.x,L.flag.y-70,5,70);ctx.fillStyle='#ef5a67';ctx.beginPath();ctx.moveTo(L.flag.x+5,L.flag.y-70);ctx.lineTo(L.flag.x+48,L.flag.y-55);ctx.lineTo(L.flag.x+5,L.flag.y-40);ctx.fill();
  for(const b of game.bullets){ctx.fillStyle=b.bomb?'#ff9d4a':game.profile.weapon==='laser'?'#9dfcff':'#f6e35f';ctx.fillRect(b.x,b.y,b.w,b.h);}
  for(const b of game.enemyBullets){ctx.fillStyle='#ff6b75';ctx.fillRect(b.x,b.y,b.w,b.h);}
  drawCharacter(game.player);
  for(const pt of game.particles){ctx.fillStyle='#fff';ctx.fillRect(pt.x,pt.y,4,4);}
  ctx.restore();
}

function updateHUD(){
  if(!game)return;const p=game.profile,need=xpNeed();
  if(ui.health)ui.health.style.width=`${Math.max(0,Math.min(100,p.hp/p.maxHp*100))}%`;
  if(ui.level)ui.level.textContent=p.level;
  if(ui.level2)ui.level2.textContent=`LEVEL ${game.n+1} — ${game.lvl.name}`;
  if(ui.xp)ui.xp.textContent=`${Math.floor(p.xp)}/${need}`;
  if(ui.xpFill)ui.xpFill.style.width=`${Math.max(0,Math.min(100,p.xp/need*100))}%`;
  if(ui.coins)ui.coins.textContent=p.coins;
  if(ui.gems)ui.gems.textContent=p.gems;
  if(ui.weapon)ui.weapon.textContent=weaponName[p.weapon]||'BLASTER';
  if(ui.lives){const hearts=Math.max(0,Math.min(3,Math.ceil(p.hp)));ui.lives.textContent='♥'.repeat(hearts)+'♡'.repeat(3-hearts);}
  if(ui.power)ui.power.textContent=game.power?`POWER: ${String(game.power).toUpperCase()}`:'NO POWER-UP';
  if(ui.quests)ui.quests.innerHTML=game.quest.map(q=>`<div class="quest ${q.done?'done':''}"><span>${q.done?'✓':'□'} ${q.label}<small>${q.done?' COMPLETE':` ${q.progress}/${q.target}`}</small></span><b>+${q.reward} XP</b></div>`).join('');
}

function togglePause(){
  if(!game)return;
  if(game.state==='playing'){game.state='paused';showOverlay('PAUSED','Press START to continue.','CONTINUE');}
  else if(game.state==='paused'){game.state='playing';hideOverlay();last=performance.now();}
}
function key(code,down){
  if(code==='ArrowLeft'||code==='KeyA')input.left=down;
  if(code==='ArrowRight'||code==='KeyD')input.right=down;
  if(code==='ArrowUp'||code==='KeyW'||code==='Space')input.jump=down;
  if(code==='KeyJ'||code==='KeyB')input.fire=down;
  if(code==='KeyX'||code==='ShiftLeft')input.dash=down;
  if(code==='KeyY'&&down)cycleWeapon();if(code==='KeyP'&&down)togglePause();if(code==='KeyR'&&down)restart();
}
window.addEventListener('keydown',e=>{key(e.code,true);if(['ArrowLeft','ArrowRight','ArrowUp','Space'].includes(e.code))e.preventDefault();});
window.addEventListener('keyup',e=>key(e.code,false));
function bindHold(element,action){
  if(!element)return;const press=e=>{e.preventDefault();input[action]=true;};const release=e=>{e.preventDefault();input[action]=false;};
  element.addEventListener('pointerdown',press);element.addEventListener('pointerup',release);element.addEventListener('pointercancel',release);element.addEventListener('pointerleave',release);
}
document.querySelectorAll('[data-key]').forEach(button=>{const k=button.dataset.key;if(k==='left')bindHold(button,'left');else if(k==='right')bindHold(button,'right');else if(k==='up'||k==='a')bindHold(button,'jump');else if(k==='down')bindHold(button,'down');else if(k==='b')bindHold(button,'fire');else if(k==='x')bindHold(button,'dash');else if(k==='y')button.addEventListener('pointerdown',e=>{e.preventDefault();cycleWeapon();});});

const startButton=$('startBtn');
if(startButton)startButton.addEventListener('click',()=>{
  if(!game||game.state==='win'){start(0);return;}
  if(game.state==='between'){start(game.n+1);return;}
  if(game.state==='paused'){togglePause();return;}
  if(game.state==='playing'&&!ui.overlay.classList.contains('hidden')){hideOverlay();return;}
  start(0);
});

function loop(now){const dt=Math.min(2,(now-last)/16.67);last=now;update(dt);draw();raf=requestAnimationFrame(loop);}
showOverlay('MUSHROOM MEADOW RUN','A retro platform adventure. Complete quests, gain XP, level up, and clear 12 worlds.','START GAME');
raf=requestAnimationFrame(loop);