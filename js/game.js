/**
 * EUP 3D — recriação das mecânicas da demo top-down
 * inventário, chaves, portas, inimigos (billboard), sanidade, lanterna, ataque
 */
(function () {
  if (typeof THREE === 'undefined' || typeof EUPMap === 'undefined') {
    document.body.innerHTML = '<p style="color:#c44;padding:2rem">Erro Three/Map.</p>';
    return;
  }

  const wrap = document.getElementById('canvas-wrap');
  const startScreen = document.getElementById('start-screen');
  const gameoverScreen = document.getElementById('gameover-screen');
  const promptEl = document.getElementById('prompt');
  const messageEl = document.getElementById('message');
  const roomNameEl = document.getElementById('room-name');
  const objectiveEl = document.getElementById('objective');
  const sanityFill = document.getElementById('sanity-fill');
  const condText = document.getElementById('cond-text');

  function showMessage(text, ms) {
    ms = ms || 2500;
    messageEl.textContent = text;
    messageEl.classList.add('show');
    clearTimeout(showMessage._t);
    showMessage._t = setTimeout(function () {
      messageEl.classList.remove('show');
    }, ms);
  }
  function setPrompt(t) {
    if (!t) {
      promptEl.classList.add('hidden');
      promptEl.textContent = '';
      return;
    }
    promptEl.textContent = t;
    promptEl.classList.remove('hidden');
  }

  // ----- items -----
  const ITEM_DEF = {
    chave_beco: { name: 'Chave da Mansão', icon: '🔑' },
    chave_esq: { name: 'Chave Oeste', icon: '🔑' },
    chave_dir: { name: 'Chave Leste', icon: '🔑' },
    chave_elite: { name: 'Chave do Elite', icon: '🔑' },
    lanterna: { name: 'Lanterna', icon: '🔦' },
    cafe: { name: 'Café', icon: '☕' },
    faca: { name: 'Faca', icon: '🔪' },
    carta: { name: 'Carta', icon: '📜' },
  };

  // ----- world pickups (posições no mapa 3D) -----
  const PICKUPS = [
    { id: 'pk_lanterna', x: -3, z: 21, item: 'lanterna', taken: false },
    { id: 'pk_cafe', x: 3, z: 19, item: 'cafe', taken: false },
    { id: 'pk_chave_beco', x: 2.5, z: 22, item: 'chave_beco', taken: false }, // bar
    { id: 'pk_chave_esq', x: -1, z: 0, item: 'chave_esq', taken: false }, // hall
    { id: 'pk_chave_dir', x: -22, z: 0, item: 'chave_dir', taken: false }, // quarto oeste
    { id: 'pk_faca', x: 22, z: -1, item: 'faca', taken: false },
    { id: 'pk_carta', x: 20, z: 2, item: 'carta', taken: false },
  ];

  // portas interativas
  const DOORS = [
    {
      id: 'door_hall_beco',
      x: 0, z: 6.9, r: 1.4,
      label: 'Porta do beco',
      locked: true,
      key: 'chave_beco',
      // ao abrir, só destranca (já tem vão no mapa)
    },
    {
      id: 'door_west',
      x: -9, z: 1, r: 1.3,
      label: 'Corredor oeste',
      locked: true,
      key: 'chave_esq',
    },
    {
      id: 'door_east',
      x: 9, z: 1, r: 1.3,
      label: 'Corredor leste',
      locked: true,
      key: 'chave_dir',
    },
  ];

  // inimigos
  const ENEMY_SPAWNS = [
    { type: 'fantasma', x: -4, z: 2 },
    { type: 'aranha', x: 4, z: -2 },
    { type: 'fantasma', x: -14, z: 1 },
    { type: 'aranha', x: 14, z: 1 },
    { type: 'manequim', x: 22, z: 1, elite: true },
  ];

  // ----- renderer PS1 -----
  const renderer = new THREE.WebGLRenderer({ antialias: false });
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.setPixelRatio(1);
  wrap.appendChild(renderer.domElement);

  const IW = 640, IH = 360;
  const rt = new THREE.WebGLRenderTarget(IW, IH, {
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    generateMipmaps: false,
  });

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0806);
  scene.fog = new THREE.FogExp2(0x0a0806, 0.04);

  scene.add(new THREE.AmbientLight(0x3a322c, 0.45));
  const sun = new THREE.DirectionalLight(0xffe0c0, 0.5);
  sun.position.set(5, 12, 3);
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0x4050a0, 0.18);
  fill.position.set(-6, 4, -2);
  scene.add(fill);
  const playerLight = new THREE.PointLight(0xffc080, 0, 10, 2);
  scene.add(playerLight);

  // ----- player state -----
  const state = {
    x: 0, z: 20, // spawn no BAR
    angle: Math.PI,
    speed: 0.068,
    turn: 0.05,
    radius: 0.32,
    sanity: 100,
    inv: [null, null, null, null],
    slot: 0,
    hasLantern: false,
    lanternOn: false,
    attacking: false,
    attackT: 0,
    invuln: 0,
    alive: true,
  };

  const loader = new THREE.TextureLoader();
  function loadTex(url) {
    const t = loader.load(url);
    t.magFilter = THREE.NearestFilter;
    t.minFilter = THREE.NearestFilter;
    t.generateMipmaps = false;
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  // player billboard
  const playerTex = {
    down: loadTex('assets/sprites/player/walk_down_1.png'),
    up: loadTex('assets/sprites/player/walk_up_1.png'),
    left: loadTex('assets/sprites/player/walk_left_1.png'),
    right: loadTex('assets/sprites/player/walk_right_1.png'),
    punch: loadTex('assets/sprites/player/punch_down_1.png'),
  };
  const playerMat = new THREE.SpriteMaterial({
    map: playerTex.down,
    transparent: true,
    alphaTest: 0.1,
  });
  const playerSprite = new THREE.Sprite(playerMat);
  playerSprite.scale.set(1.3, 1.8, 1);
  scene.add(playerSprite);

  // pickups as sprites/meshes
  const pickupMeshes = [];
  function makePickupVisual(p) {
    const def = ITEM_DEF[p.item] || { icon: '?', name: p.item };
    // glowing box low poly
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.35, 0.35, 0.35),
      new THREE.MeshLambertMaterial({
        color: p.item.indexOf('chave') === 0 ? 0xc0a040 : p.item === 'lanterna' ? 0x80b0ff : 0x40c060,
        flatShading: true,
        emissive: 0x221100,
      })
    );
    mesh.position.set(p.x, 0.35, p.z);
    mesh.userData.pickupId = p.id;
    scene.add(mesh);
    pickupMeshes.push({ mesh: mesh, data: p });
  }

  // enemies billboard
  const enemies = [];
  function spawnEnemy(sp) {
    const folder = sp.type === 'manequim' ? 'manequim' : sp.type;
    const file =
      sp.type === 'manequim'
        ? 'assets/sprites/manequim/manequim_parado_1.png'
        : 'assets/sprites/' + folder + '/' + folder + '_andando_1.png';
    const tex = loadTex(file);
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, alphaTest: 0.1 });
    const spr = new THREE.Sprite(mat);
    spr.scale.set(sp.elite ? 1.8 : 1.4, sp.elite ? 2.4 : 1.6, 1);
    spr.position.set(sp.x, sp.elite ? 1.2 : 0.9, sp.z);
    scene.add(spr);
    enemies.push({
      sprite: spr,
      x: sp.x,
      z: sp.z,
      type: sp.type,
      elite: !!sp.elite,
      hp: sp.elite ? 120 : sp.type === 'aranha' ? 35 : 45,
      speed: sp.elite ? 0.025 : sp.type === 'aranha' ? 0.045 : 0.03,
      aggro: 5.5,
      damage: sp.elite ? 14 : 8,
      alive: true,
      hitCd: 0,
    });
  }

  // door blockers when locked — extra colliders toggled
  const doorBlockers = [];
  function setupDoorBlockers() {
    DOORS.forEach(function (d) {
      if (!d.locked) return;
      // temporary wall in opening
      const col = {
        min: { x: d.x - 1.0, z: d.z - 0.4 },
        max: { x: d.x + 1.0, z: d.z + 0.4 },
        label: 'door_' + d.id,
        doorId: d.id,
      };
      EUPMap.COLLIDERS.push(col);
      doorBlockers.push(col);
    });
  }

  function unlockDoor(d) {
    d.locked = false;
    for (let i = EUPMap.COLLIDERS.length - 1; i >= 0; i--) {
      if (EUPMap.COLLIDERS[i].doorId === d.id) EUPMap.COLLIDERS.splice(i, 1);
    }
  }

  let mapRoot = null;
  let colliderHelpers = [];
  let showColliders = false;
  let gameRunning = false;
  let activeCamId = 'bar';
  const camera = new THREE.PerspectiveCamera(40, IW / IH, 0.1, 100);
  let frame = 0;

  function applyCamera(id) {
    const c = EUPMap.CAMERAS[id];
    if (!c) return;
    activeCamId = id;
    camera.position.set(c.pos.x, c.pos.y, c.pos.z);
    camera.lookAt(c.look.x, c.look.y, c.look.z);
    roomNameEl.textContent = c.name;
  }

  function updateCameraByZone() {
    const p = { x: state.x, z: state.z };
    const order = [
      'west_room', 'east_room', 'west_corridor', 'east_corridor',
      'bar', 'beco', 'hall_stairs', 'hall',
    ];
    for (let i = 0; i < order.length; i++) {
      const id = order[i];
      const c = EUPMap.CAMERAS[id];
      if (c && c.zone(p)) {
        if (activeCamId !== id) applyCamera(id);
        return;
      }
    }
  }

  function updateHUD() {
    const pct = Math.max(0, state.sanity);
    sanityFill.style.width = pct + '%';
    if (pct > 75) {
      condText.textContent = 'FINE';
      condText.style.color = '#4aca60';
    } else if (pct > 40) {
      condText.textContent = 'CAUTION';
      condText.style.color = '#caca40';
    } else {
      condText.textContent = 'DANGER';
      condText.style.color = '#ca3030';
    }
    // inventory
    const slots = document.querySelectorAll('#inv-bar .slot');
    slots.forEach(function (el, i) {
      el.classList.toggle('selected', i === state.slot);
      const it = state.inv[i];
      el.textContent = it ? (ITEM_DEF[it] || {}).icon || '?' : '';
      el.title = it ? (ITEM_DEF[it] || {}).name || it : '';
    });
    // objective
    if (!state.inv.includes('chave_beco') && !doorUnlocked('door_hall_beco')) {
      objectiveEl.textContent = 'Objetivo: no bar, pegue a chave da mansão';
    } else if (DOORS.find(function (d) { return d.id === 'door_hall_beco' && d.locked; })) {
      objectiveEl.textContent = 'Objetivo: abra a porta do beco (hall)';
    } else if (state.inv.includes('chave_esq') || !doorUnlocked('door_west')) {
      if (DOORS.find(function (d) { return d.id === 'door_west' && d.locked; })) {
        objectiveEl.textContent = state.inv.includes('chave_esq')
          ? 'Objetivo: abra o corredor oeste'
          : 'Objetivo: ache a chave oeste no hall';
      } else if (DOORS.find(function (d) { return d.id === 'door_east' && d.locked; })) {
        objectiveEl.textContent = state.inv.includes('chave_dir')
          ? 'Objetivo: abra o corredor leste'
          : 'Objetivo: chave leste no quarto oeste';
      } else {
        objectiveEl.textContent = 'Objetivo: derrote o manequim no quarto leste';
      }
    } else {
      objectiveEl.textContent = 'Objetivo: explore a mansão';
    }
  }

  function doorUnlocked(id) {
    const d = DOORS.find(function (x) { return x.id === id; });
    return d && !d.locked;
  }

  function hasItem(id) {
    return state.inv.indexOf(id) >= 0;
  }
  function addItem(id) {
    for (let i = 0; i < 4; i++) {
      if (!state.inv[i]) {
        state.inv[i] = id;
        if (id === 'lanterna') state.hasLantern = true;
        return true;
      }
    }
    return false;
  }
  function removeItem(id) {
    const i = state.inv.indexOf(id);
    if (i >= 0) state.inv[i] = null;
  }

  function near(ax, az, bx, bz, r) {
    return Math.hypot(ax - bx, az - bz) < r;
  }

  function interact() {
    // pickup
    for (let i = 0; i < PICKUPS.length; i++) {
      const p = PICKUPS[i];
      if (p.taken) continue;
      if (near(state.x, state.z, p.x, p.z, 1.2)) {
        if (addItem(p.item)) {
          p.taken = true;
          const vis = pickupMeshes.find(function (m) { return m.data.id === p.id; });
          if (vis) vis.mesh.visible = false;
          showMessage('Pegou: ' + ((ITEM_DEF[p.item] || {}).name || p.item));
          updateHUD();
        } else showMessage('Inventário cheio.');
        return;
      }
    }
    // doors
    for (let i = 0; i < DOORS.length; i++) {
      const d = DOORS[i];
      if (near(state.x, state.z, d.x, d.z, d.r)) {
        if (!d.locked) {
          showMessage(d.label + ' — aberta.');
          return;
        }
        if (d.key && hasItem(d.key)) {
          unlockDoor(d);
          removeItem(d.key);
          showMessage('Destrancou: ' + d.label);
          updateHUD();
        } else {
          showMessage('Trancada. Precisa da chave certa.');
        }
        return;
      }
    }
    // use selected
    const sel = state.inv[state.slot];
    if (sel === 'cafe') {
      state.sanity = Math.min(100, state.sanity + 25);
      state.inv[state.slot] = null;
      showMessage('Café. +25 sanidade.');
      updateHUD();
    }
  }

  function attack() {
    if (state.attacking || !gameRunning) return;
    state.attacking = true;
    state.attackT = 20;
    playerMat.map = playerTex.punch;
    playerMat.needsUpdate = true;
    const range = hasItem('faca') ? 2.0 : 1.4;
    const dmg = hasItem('faca') ? 28 : 12;
    enemies.forEach(function (e) {
      if (!e.alive) return;
      if (near(state.x, state.z, e.x, e.z, range)) {
        e.hp -= dmg;
        if (e.hp <= 0) {
          e.alive = false;
          e.sprite.visible = false;
          showMessage(e.elite ? 'O manequim caiu...' : 'Inimigo derrotado.');
          if (e.elite && addItem('carta')) {
            showMessage('Uma carta caiu no chão... (inventário)');
          }
        }
      }
    });
  }

  function updateEnemies() {
    enemies.forEach(function (e) {
      if (!e.alive) return;
      if (e.hitCd > 0) e.hitCd--;
      const dist = Math.hypot(state.x - e.x, state.z - e.z);
      if (dist < e.aggro) {
        const ang = Math.atan2(state.x - e.x, state.z - e.z);
        const nx = e.x + Math.sin(ang) * e.speed;
        const nz = e.z + Math.cos(ang) * e.speed;
        if (!EUPMap.collides(nx, nz, 0.3)) {
          e.x = nx;
          e.z = nz;
        }
        e.sprite.position.x = e.x;
        e.sprite.position.z = e.z;
        if (dist < 1.1 && e.hitCd <= 0 && state.invuln <= 0) {
          state.sanity = Math.max(0, state.sanity - e.damage);
          state.invuln = 40;
          e.hitCd = 35;
          updateHUD();
          if (state.sanity <= 0) die();
        }
      }
    });
  }

  function die() {
    state.alive = false;
    gameRunning = false;
    gameoverScreen.classList.remove('hidden');
  }

  function updatePrompt() {
    for (let i = 0; i < PICKUPS.length; i++) {
      const p = PICKUPS[i];
      if (!p.taken && near(state.x, state.z, p.x, p.z, 1.2)) {
        setPrompt('E — Pegar ' + ((ITEM_DEF[p.item] || {}).name || p.item));
        return;
      }
    }
    for (let i = 0; i < DOORS.length; i++) {
      const d = DOORS[i];
      if (near(state.x, state.z, d.x, d.z, d.r)) {
        setPrompt(d.locked ? 'E — ' + d.label + ' (trancada)' : 'E — ' + d.label);
        return;
      }
    }
    setPrompt('');
  }

  function updatePlayerFacing() {
    // billboard face by movement angle relative to coarse dirs
    let a = state.angle;
    while (a < 0) a += Math.PI * 2;
    while (a > Math.PI * 2) a -= Math.PI * 2;
    // 0 = +Z in our move (sin/cos), adjust
    const deg = (a * 180) / Math.PI;
    let map = playerTex.down;
    // approximate
    const fwd = (a + Math.PI * 2) % (Math.PI * 2);
    if (fwd > Math.PI * 0.25 && fwd <= Math.PI * 0.75) map = playerTex.right;
    else if (fwd > Math.PI * 0.75 && fwd <= Math.PI * 1.25) map = playerTex.up;
    else if (fwd > Math.PI * 1.25 && fwd <= Math.PI * 1.75) map = playerTex.left;
    else map = playerTex.down;
    if (!state.attacking && playerMat.map !== map) {
      playerMat.map = map;
      playerMat.needsUpdate = true;
    }
  }

  const keys = {};
  window.addEventListener('keydown', function (e) {
    const k = e.key.toLowerCase();
    keys[k] = true;
    if (e.key.startsWith('Arrow') || e.key === ' ') e.preventDefault();
    if (!gameRunning) return;

    if (k >= '1' && k <= '4') {
      state.slot = parseInt(k, 10) - 1;
      updateHUD();
    }
    if (k === 'e') interact();
    if (k === ' ' || k === 'x') attack();
    if (k === 'f') {
      if (state.hasLantern) {
        state.lanternOn = !state.lanternOn;
        showMessage(state.lanternOn ? 'Lanterna ligada' : 'Lanterna desligada');
      } else showMessage('Sem lanterna');
    }
    if (k === 'c') {
      const ids = Object.keys(EUPMap.CAMERAS);
      applyCamera(ids[(ids.indexOf(activeCamId) + 1) % ids.length]);
    }
    if (k === 'v') {
      showColliders = !showColliders;
      colliderHelpers.forEach(function (h) { h.visible = showColliders; });
    }
  });
  window.addEventListener('keyup', function (e) {
    keys[e.key.toLowerCase()] = false;
  });

  function update() {
    if (!gameRunning || !state.alive) return;
    frame++;
    if (state.invuln > 0) state.invuln--;
    if (state.attacking) {
      state.attackT--;
      if (state.attackT <= 0) {
        state.attacking = false;
        updatePlayerFacing();
      }
    }

    let turn = 0, forward = 0;
    if (keys['arrowleft'] || keys['a']) turn += 1;
    if (keys['arrowright'] || keys['d']) turn -= 1;
    if (keys['arrowup'] || keys['w']) forward += 1;
    if (keys['arrowdown'] || keys['s']) forward -= 1;

    state.angle += turn * state.turn;
    if (forward !== 0) {
      const dx = Math.sin(state.angle) * state.speed * forward;
      const dz = Math.cos(state.angle) * state.speed * forward;
      const nx = state.x + dx;
      const nz = state.z + dz;
      if (!EUPMap.collides(nx, nz, state.radius)) {
        state.x = nx;
        state.z = nz;
      } else if (!EUPMap.collides(nx, state.z, state.radius)) {
        state.x = nx;
      } else if (!EUPMap.collides(state.x, nz, state.radius)) {
        state.z = nz;
      }
      updatePlayerFacing();
    }

    playerSprite.position.set(state.x, 0.95, state.z);
    playerLight.position.set(state.x, 1.6, state.z);
    playerLight.intensity = state.lanternOn ? 1.4 : 0.15;

    // bob pickups
    pickupMeshes.forEach(function (pm) {
      if (pm.data.taken) return;
      pm.mesh.position.y = 0.35 + Math.sin(frame * 0.08 + pm.data.x) * 0.08;
      pm.mesh.rotation.y += 0.02;
    });

    updateEnemies();
    updateCameraByZone();
    updatePrompt();
    if (frame % 30 === 0) updateHUD();
  }

  function buildColliderDebug() {
    colliderHelpers.forEach(function (h) { scene.remove(h); });
    colliderHelpers = [];
    EUPMap.COLLIDERS.forEach(function (c) {
      const w = c.max.x - c.min.x;
      const d = c.max.z - c.min.z;
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(w, 0.12, d),
        new THREE.MeshBasicMaterial({ color: 0xff2244, transparent: true, opacity: 0.3, depthWrite: false })
      );
      mesh.position.set((c.min.x + c.max.x) / 2, 0.08, (c.min.z + c.max.z) / 2);
      mesh.visible = false;
      scene.add(mesh);
      colliderHelpers.push(mesh);
    });
  }

  const screenScene = new THREE.Scene();
  const screenCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const screenMat = new THREE.MeshBasicMaterial({ map: rt.texture });
  screenMat.map.minFilter = THREE.NearestFilter;
  screenMat.map.magFilter = THREE.NearestFilter;
  screenScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), screenMat));

  function loop() {
    requestAnimationFrame(loop);
    update();
    // darkness without lantern in hall-ish
    scene.fog.density = state.lanternOn ? 0.028 : 0.05;
    renderer.setRenderTarget(rt);
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
    renderer.render(screenScene, screenCam);
  }

  window.addEventListener('resize', function () {
    renderer.setSize(window.innerWidth, window.innerHeight, false);
  });

  function initGame() {
    // reset pickups/doors/enemies
    PICKUPS.forEach(function (p) { p.taken = true; }); // will reset below
    // clear old enemy sprites
    enemies.forEach(function (e) { scene.remove(e.sprite); });
    enemies.length = 0;
    pickupMeshes.forEach(function (pm) { scene.remove(pm.mesh); });
    pickupMeshes.length = 0;

    PICKUPS.forEach(function (p) {
      p.taken = false;
      makePickupVisual(p);
    });
    DOORS.forEach(function (d) {
      if (d.key) d.locked = true;
    });
    // clean old door colliders
    for (let i = EUPMap.COLLIDERS.length - 1; i >= 0; i--) {
      if (EUPMap.COLLIDERS[i].doorId) EUPMap.COLLIDERS.splice(i, 1);
    }
    setupDoorBlockers();
    ENEMY_SPAWNS.forEach(spawnEnemy);

    state.x = 0;
    state.z = 20;
    state.angle = Math.PI;
    state.sanity = 100;
    state.inv = [null, null, null, null];
    state.slot = 0;
    state.hasLantern = false;
    state.lanternOn = false;
    state.alive = true;
    state.invuln = 0;

    applyCamera('bar');
    updateHUD();
    gameoverScreen.classList.add('hidden');
    startScreen.classList.add('hidden');
    gameRunning = true;
    showMessage('Você acorda no bar. A mansão espera.');
  }

  document.getElementById('btn-start').addEventListener('click', initGame);
  document.getElementById('btn-restart').addEventListener('click', initGame);

  EUPMap.loadTextures(THREE, function () {
    mapRoot = EUPMap.buildMap(THREE);
    scene.add(mapRoot);
    buildColliderDebug();
    playerSprite.position.set(0, 0.95, 20);
    applyCamera('bar');
    loop();
  });
})();
