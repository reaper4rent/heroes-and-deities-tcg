/* Heroes & Deities TCG — client */
(function(){
  const $ = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => [...r.querySelectorAll(s)];
  const saveKey = "hd-tcg-v1";
  const defaultState = () => ({ credits: 200, tips: true, owned: seedOwned(), finishes: {}, wins: 0, losses: 0 });
  function seedOwned(){
    const o = {};
    for (const id of ["001", ...HD.ST01.main, "002", ...HD.ST02.main]) o[id] = (o[id]||0)+1;
    return o;
  }
  let S = load();
  function load(){ try { return Object.assign(defaultState(), JSON.parse(localStorage.getItem(saveKey)||"{}")); } catch { return defaultState(); } }
  function persist(){ localStorage.setItem(saveKey, JSON.stringify(S)); }
  function show(id){
    $$(".screen").forEach(el => el.classList.toggle("on", el.id === id));
    if (id === "collection") renderCollection();
    if (id === "store") renderStore();
    if (id === "howto") renderHowto();
  }
  window.HDShow = show;
  function plateHTML(c, extra={}){
    if (!c) return "";
    const fin = extra.finish || HD.finishOf(c, extra.seed);
    const cls = ["plate", fin, extra.cls||""].filter(Boolean).join(" ");
    const pwr = c.power ? c.power.toLocaleString() : "";
    const cost = c.kind==="paragon" ? "" : `<div class="cost">${c.cost??0}</div>`;
    return `<article class="${cls}" data-id="${c.id}" title="${c.name}">
      <div class="art"></div>${cost}<div class="el">🔥</div>
      ${pwr?`<div class="pwr">${pwr}</div>`:""}
      <div class="txt">${c.ability||""}</div>
      <div class="ban"><small>${(c.kind||"").toUpperCase()}</small><b>${c.name}</b></div>
      <div class="foot"><span>HD-${c.id} · ${c.rarity}${fin?" · "+fin.toUpperCase():""}</span><span>${c.tribe||""}</span></div>
    </article>`;
  }
  function renderCollection(){
    const q = ($("#q")?.value||"").toLowerCase();
    const list = Object.values(HD.CARDS).filter(c => !q || (c.name+c.id+c.tribe+c.kind).toLowerCase().includes(q));
    $("#collection-grid").innerHTML = list.map(c => {
      const n = S.owned[c.id]||0;
      return `<div>${plateHTML(c,{finish:S.finishes[c.id]||c.finish})}<div style="text-align:center;font-size:12px;margin-top:4px">${n? "×"+n : "locked"}</div></div>`;
    }).join("");
  }
  function rollRarity(){
    const r = Math.random()*100; let acc=0;
    for (const [k,w] of Object.entries(HD.RARITY_WEIGHT)){ acc += w; if (r <= acc) return k; }
    return "C";
  }
  function openPack(){
    if (S.credits < 100) return alert("Need 100 credits. Win battles to earn more.");
    S.credits -= 100;
    const pack = [];
    for (let i=0;i<6;i++){
      const rar = i===5 ? (Math.random()<0.035?"M":rollRarity()) : rollRarity();
      const pool = HD.PACK_POOL.filter(c => c.rarity===rar);
      const c = (pool.length?pool:HD.PACK_POOL)[Math.floor(Math.random()*(pool.length||HD.PACK_POOL.length))];
      pack.push(c);
      S.owned[c.id] = (S.owned[c.id]||0)+1;
      if (HD.canFinish(c)){
        const f = Math.random()<0.5 ? "foil":"holo";
        S.finishes[c.id] = f; c._packFinish = f;
      }
    }
    persist();
    $("#pack-result").innerHTML = `<p>Opened a pack (−100 credits). Credits: ${S.credits}</p><div class="grid">` +
      pack.map(c => plateHTML(c,{finish:c._packFinish||S.finishes[c.id]})).join("") + `</div>`;
    renderStore();
  }
  function renderStore(){ $("#credits").textContent = S.credits; $("#record").textContent = `${S.wins}W / ${S.losses}L`; }
  function renderHowto(){ $("#tips-state").textContent = S.tips ? "ON" : "OFF"; }
  window.toggleTips = () => { S.tips = !S.tips; persist(); renderHowto(); };
  let B = null;
  function shuffle(a){ for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; }
  function side(deck){
    const main = shuffle(deck.main.slice());
    return { name: deck.name, paragon: deck.paragon, awakened:false, hp:6, divine:0, hand: main.splice(0,5), deck: main, field:[], grave:[], relics:[], domain:null, temp:{} };
  }
  function startBattle(playerDeck, aiDeck, first){
    B = { p: side(playerDeck), a: side(aiDeck), turn: first, phase: "main", log: [], firstPlayer: first, selected: null, attacker: null };
    log(`Battle start. First player (${first==="p"?"you":"AI"}) begins with 2 Divine. HP starts at 6.`);
    show("battle"); renderBattle();
  }
  function log(m){ B.log.push(m); }
  function card(id){ return HD.CARDS[id] || HD.DIVINE; }
  function auraBonus(side, unit, attacking){
    let n=0; const pg = card(side.paragon);
    if (attacking && pg.id==="001" && (unit.tribe==="Ares Host"||unit.tribe==="Cyclopean Forge"||unit.tribe==="Myrmidons")) n+=500;
    if (attacking && pg.id==="002" && side.awakened && (unit.tribe==="Cyclopean Forge"||unit.bloodline==="Titanborn")) n+=1000;
    if (attacking && pg.id==="001" && side.awakened && unit.element==="Ember") n+=1000;
    if (attacking && side.domain==="036" && unit.element==="Ember") n+=500;
    if (attacking && side.domain==="040" && (unit.tribe==="Cyclopean Forge"||unit.bloodline==="Titanborn")) n+=500;
    if (attacking && side.relics.includes("035")) n+=500;
    return n;
  }
  function powerOf(side, id, {attacking=false, defending=false, counter=false}={}){
    const c = card(id); let p = c.power||0;
    if (c.kind==="paragon") p = 5000;
    p += auraBonus(side, c, attacking);
    if (side.relics.includes("034") && c.kind==="paragon") p += 1000;
    if (defending && side.relics.includes("038") && c.kind==="paragon") p += 1000;
    if (counter && c.counter) p += c.counter;
    if (side.temp[id]) p += side.temp[id];
    if (side.temp._all) p += side.temp._all;
    return p;
  }
  function draw(side, n=1){
    for(let i=0;i<n;i++){
      if (!side.deck.length){ log(side.name+" decked out — lose 1 HP."); side.hp--; continue; }
      side.hand.push(side.deck.shift());
    }
  }
  function beginTurn(who){
    B.turn = who; B.phase="main"; B.selected=null; B.attacker=null;
    const s = B[who];
    if (!s._hadTurn) s.divine = (who === B.firstPlayer) ? 2 : 3;
    else s.divine = Math.min(10, s.divine + 2);
    s._hadTurn = true; s.temp = {}; draw(s,1);
    log(`Turn — ${who==="p"?"You":"AI"} (Divine ${s.divine}, HP ${s.hp})`);
    if (s.hp<=2 && !s.awakened){ s.awakened = true; log("Paragon Awakens."); }
  }
  function playCard(who, handIdx){
    const s = B[who]; const id = s.hand[handIdx]; const c = card(id);
    if (c.kind==="paragon") return;
    if ((c.cost||0) > s.divine){ if(who==="p") log("Not enough Divine."); return; }
    s.divine -= c.cost||0; s.hand.splice(handIdx,1);
    if (c.kind==="character"){ s.field.push({id, sick: !(c.keywords||[]).includes("RUSH")}); log(`${who==="p"?"You":"AI"} play ${c.name}.`); }
    else if (c.kind==="event" || c.kind==="mythic"){ resolveEvent(who, c); s.grave.push(id); }
    else if (c.kind==="relic"){ s.relics.push(id); log(`Relic ${c.name} enters.`); }
    else if (c.kind==="domain"){ s.domain = id; log(`Domain ${c.name} set.`); }
  }
  function resolveEvent(who, c){
    const me = B[who], opp = B[who==="p"?"a":"p"];
    if (c.id==="031" || c.id==="042"){
      if (opp.field.length){ const t = opp.field[0]; opp.temp[t.id] = (opp.temp[t.id]||0) + (c.id==="031"?-3000:-2000); log(`${c.name} weakens ${card(t.id).name}.`); }
      if (c.id==="042") draw(me,1);
    } else if (c.id==="032" || c.id==="054"){ me.temp._all = (me.temp._all||0)+1000; log(`${c.name}: +1,000 to your Characters.`); }
    else if (c.id==="045" || c.id==="039" || c.id==="043" || c.id==="058"){ draw(me,1); log(`${c.name}: draw 1.`); }
    else if (c.id==="037" || c.id==="041"){ opp.field.forEach(u => opp.temp[u.id]=(opp.temp[u.id]||0)-2000); log(`${c.name} shakes the field.`); }
  }
  function attack(who, fromFieldIdx){
    const me = B[who], opp = B[who==="p"?"a":"p"];
    let unit = fromFieldIdx === "paragon" ? {id: me.paragon, sick:false} : me.field[fromFieldIdx];
    if (!unit || unit.sick){ if(who==="p") log("That unit cannot attack yet."); return; }
    const guards = opp.field.filter(u => (card(u.id).keywords||[]).includes("GUARD"));
    const target = guards[0] || null;
    const atkP = powerOf(me, unit.id, {attacking:true});
    if (!target){
      const defP = powerOf(opp, opp.paragon, {defending:true});
      log(`${card(unit.id).name} (${atkP}) strikes the Paragon (${defP}).`);
      if (atkP > defP){
        opp.hp--; log(`Hit! Opponent HP ${opp.hp}.`); fate(opp);
        if (opp.hp<=0){ endGame(who); return; }
        if (opp.hp<=2 && !opp.awakened){ opp.awakened=true; log("Defending Paragon Awakens."); }
      } else log("The Paragon holds.");
    } else {
      const defP = powerOf(opp, target.id, {defending:true, counter:true});
      log(`${card(unit.id).name} (${atkP}) vs ${card(target.id).name} (${defP}).`);
      if (atkP > defP){
        opp.field = opp.field.filter(u => u!==target); opp.grave.push(target.id);
        log(`${card(target.id).name} is defeated.`);
        if ((card(unit.id).keywords||[]).includes("BLOODLUST")) draw(me,1);
      } else if (defP > atkP && fromFieldIdx!=="paragon"){
        me.field = me.field.filter(u => u!==unit); me.grave.push(unit.id);
        log(`${card(unit.id).name} is defeated.`);
      } else log("Neither falls.");
    }
  }
  function fate(side){
    const fateCards = side.hand.filter(id => (card(id).keywords||[]).includes("FATE") || /FATE/.test(card(id).ability||""));
    if (fateCards.length) log(`Fate stirs (${fateCards.length} in hand).`);
  }
  function endTurn(){
    const who = B.turn; B[who].field.forEach(u => u.sick=false);
    const next = who==="p"?"a":"p";
    if (B[next].hp<=0){ endGame(who); return; }
    beginTurn(next); if (B.turn==="a") aiTurn(); renderBattle();
  }
  function endGame(winner){
    const youWin = winner==="p";
    if (youWin){ S.wins++; S.credits += 150; } else { S.losses++; S.credits += 40; }
    persist(); log(youWin ? "Victory. +150 credits." : "Defeat. +40 credits."); B.over = true; renderBattle();
  }
  function aiTurn(){
    const s = B.a;
    s.hand.slice().forEach((id)=>{ const idx = s.hand.indexOf(id); const c = card(id);
      if (idx>=0 && (c.cost||0)<=s.divine && (c.kind==="character"?s.field.length<5:true)) playCard("a", idx); });
    s.field.forEach((u,i)=>{ if(!u.sick) attack("a", i); });
    attack("a","paragon");
    if (!B.over){ B.a.field.forEach(u=>u.sick=false); beginTurn("p"); }
    renderBattle();
  }
  function renderBattle(){
    if (!B) return;
    const hpPips = (n) => `<span class="hp">${[1,2,3,4,5,6].map(i=>`<i class="pip ${i<=n?"on":""}"></i>`).join("")}</span>`;
    $("#battle-ui").innerHTML = `
      <div class="stats">
        <div>AI · ${B.a.name} ${hpPips(B.a.hp)} Divine ${B.a.divine} · Field ${B.a.field.length} · Hand ${B.a.hand.length}</div>
        <div>You · ${B.p.name} ${hpPips(B.p.hp)} Divine ${B.p.divine} · Field ${B.p.field.length}</div>
        <div>${B.over? "GAME OVER": (B.turn==="p"?"Your turn":"AI turn")}</div>
      </div>
      <div class="row"><label>AI</label>${plateHTML(card(B.a.paragon),{cls:B.a.awakened?"foil":""})}${B.a.field.map(u=>plateHTML(card(u.id))).join("")}</div>
      <div class="row"><label>YOU</label>${plateHTML(card(B.p.paragon),{cls:B.p.awakened?"foil":""})}${B.p.field.map((u,i)=>plateHTML(card(u.id),{cls:"yours",seed:String(i)})).join("")}</div>
      <div class="log">${B.log.slice(-10).join("\n")}</div>
      ${S.tips && !B.over ? `<div class="tip">Tap a card in hand to play it (costs Divine). Tap a ready Character or your Paragon to attack. First player started with 2 Divine. At 0 HP the game ends.</div>`:""}`;
    $("#hand").innerHTML = B.p.hand.map((id,i)=>plateHTML(card(id),{cls:"in-hand",seed:String(i)})).join("");
    $$("#hand .plate").forEach((el,i)=>{ el.onclick = () => { if(B.over||B.turn!=="p")return; playCard("p", i); renderBattle(); }; });
    $$("#battle-ui .yours").forEach((el,i)=>{ el.onclick = () => { if(B.over||B.turn!=="p")return; attack("p", i); renderBattle(); }; });
    const pg = $("#battle-ui .row:nth-of-type(2) .plate");
    if (pg) pg.onclick = () => { if(B.over||B.turn!=="p")return; attack("p","paragon"); renderBattle(); };
  }
  window.HDStart = (deckId) => {
    const mine = deckId==="ST-02" ? HD.ST02 : HD.ST01;
    const theirs = deckId==="ST-02" ? HD.ST01 : HD.ST02;
    startBattle(mine, theirs, "p"); beginTurn("p"); renderBattle();
  };
  window.HDEndTurn = () => { if(B && !B.over && B.turn==="p") endTurn(); };
  window.HDOpenPack = openPack;
  window.HDHome = () => show("home");
  $("#q")?.addEventListener("input", renderCollection);
  show("home");
})();
