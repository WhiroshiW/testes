/**
 * MAPA 3D baseado no layout top-down da mansão EUP
 * Unidades em "metros". Origem = centro do HALL.
 *
 * COMO ADICIONAR TEXTURA:
 * 1. Coloque PNG em assets/textures/ (ex: floor_wood.png)
 * 2. Use tex('nome_sem_extensao') no material do mesh
 * 3. Preferir 32x32 / 64x64, power-of-two, sem anti-alias
 *
 * COMO ADICIONAR COLISÃO:
 * 1. Empurre em COLLIDERS um {min:{x,z}, max:{x,z}, label}
 * 2. min/max = canto do retângulo no chão (Y ignorado)
 * 3. Teste andando — se atravessar, aumente a caixa
 */
(function (global) {
  const WALL_H = 3.6;
  const WALL_T = 0.28;

  // --- texturas (preenchidas em runtime) ---
  const textures = {};
  let _texLoader = null;

  function loadTextures(THREE, onDone) {
    _texLoader = new THREE.TextureLoader();
    const names = [
      'floor_wood', 'floor_carpet', 'floor_stone',
      'wall_plaster', 'wall_dark',
    ];
    let left = names.length;
    names.forEach(function (n) {
      _texLoader.load(
        'assets/textures/' + n + '.png',
        function (t) {
          t.wrapS = t.wrapT = THREE.RepeatWrapping;
          t.magFilter = THREE.NearestFilter;
          t.minFilter = THREE.NearestFilter;
          t.generateMipmaps = false;
          t.colorSpace = THREE.SRGBColorSpace;
          textures[n] = t;
          left--;
          if (left <= 0 && onDone) onDone();
        },
        undefined,
        function () {
          console.warn('textura falhou:', n);
          left--;
          if (left <= 0 && onDone) onDone();
        }
      );
    });
  }

  function texMat(THREE, texName, color, repeatX, repeatY) {
    const t = textures[texName];
    if (t) {
      const ct = t.clone();
      ct.wrapS = ct.wrapT = THREE.RepeatWrapping;
      ct.repeat.set(repeatX || 1, repeatY || 1);
      ct.magFilter = THREE.NearestFilter;
      ct.minFilter = THREE.NearestFilter;
      ct.needsUpdate = true;
      return new THREE.MeshLambertMaterial({
        map: ct,
        flatShading: true,
      });
    }
    return new THREE.MeshLambertMaterial({
      color: color || 0x444444,
      flatShading: true,
    });
  }

  function boxMesh(THREE, w, h, d, material, x, y, z) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    m.position.set(x, y, z);
    return m;
  }

  // Colisores AABB no plano XZ (editável!)
  // Coordenadas alinhadas ao hall central do mapa top-down
  const COLLIDERS = [];

  function addCollider(x, z, w, d, label) {
    COLLIDERS.push({
      min: { x: x - w / 2, z: z - d / 2 },
      max: { x: x + w / 2, z: z + d / 2 },
      label: label || '',
    });
  }

  function addWall(THREE, group, x, z, w, d, mat, label) {
    group.add(boxMesh(THREE, w, WALL_H, d, mat, x, WALL_H / 2, z));
    addCollider(x, z, w + 0.1, d + 0.1, label || 'wall');
  }

  /**
   * Layout aproximado do mapa top-down (2176x1632):
   * - Centro: HALL com tapete vermelho
   * - Oeste: corredor + quartos
   * - Leste: corredor + quartos
   * - Sul: beco → bar
   * - Norte: escadas / quarto superior
   */
  function buildMap(THREE) {
    const root = new THREE.Group();
    root.name = 'mansion';

    const matFloor = texMat(THREE, 'floor_wood', 0x3a2a1c, 8, 6);
    const matCarpet = texMat(THREE, 'floor_carpet', 0x5a1820, 3, 5);
    const matStone = texMat(THREE, 'floor_stone', 0x303038, 4, 4);
    const matWall = texMat(THREE, 'wall_plaster', 0x2a1c14, 4, 2);
    const matWallD = texMat(THREE, 'wall_dark', 0x1e1814, 4, 2);
    const matDoor = new THREE.MeshLambertMaterial({ color: 0x5a3a20, flatShading: true });
    const matTrim = new THREE.MeshLambertMaterial({ color: 0x4a3a28, flatShading: true });

    // ===== HALL CENTRAL (~ centro do mapa) =====
    // chão 18 x 14
    root.add(boxMesh(THREE, 18, 0.15, 14, matFloor, 0, -0.05, 0));
    // tapete
    root.add(boxMesh(THREE, 5, 0.04, 10, matCarpet, 0, 0.04, 0));

    // paredes hall
    // norte (escadas)
    addWall(THREE, root, 0, -7, 18, WALL_T, matWall, 'hall_n');
    // sul — vão central pro beco (x -1.2..1.2)
    addWall(THREE, root, -5.5, 7, 7, WALL_T, matWall, 'hall_s_l');
    addWall(THREE, root, 5.5, 7, 7, WALL_T, matWall, 'hall_s_r');
    root.add(boxMesh(THREE, 2.4, 1.0, WALL_T, matWall, 0, WALL_H - 0.5, 7)); // lintel
    // oeste — vão pro corredor oeste
    addWall(THREE, root, -9, -3.5, WALL_T, 7, matWall, 'hall_w_n');
    addWall(THREE, root, -9, 4.5, WALL_T, 5, matWall, 'hall_w_s');
    root.add(boxMesh(THREE, WALL_T, 1.0, 2.2, matWall, -9, WALL_H - 0.5, 1));
    // leste — vão corredor leste
    addWall(THREE, root, 9, -3.5, WALL_T, 7, matWall, 'hall_e_n');
    addWall(THREE, root, 9, 4.5, WALL_T, 5, matWall, 'hall_e_s');
    root.add(boxMesh(THREE, WALL_T, 1.0, 2.2, matWall, 9, WALL_H - 0.5, 1));

    // colunas
    root.add(boxMesh(THREE, 0.7, 3.2, 0.7, matTrim, -5, 1.6, -3));
    root.add(boxMesh(THREE, 0.7, 3.2, 0.7, matTrim, 5, 1.6, -3));
    addCollider(-5, -3, 0.9, 0.9, 'coluna');
    addCollider(5, -3, 0.9, 0.9, 'coluna');

    // escada norte
    root.add(boxMesh(THREE, 4, 0.35, 1.3, matTrim, 0, 0.15, -5));
    root.add(boxMesh(THREE, 4, 0.35, 1.3, matTrim, 0, 0.5, -5.8));
    root.add(boxMesh(THREE, 4, 0.35, 1.3, matTrim, 0, 0.85, -6.5));
    addCollider(0, -6.2, 4.2, 2.2, 'escada');

    // porta visual sul (beco)
    root.add(boxMesh(THREE, 2.0, 2.5, 0.12, matDoor, 0, 1.25, 6.9));

    // ===== CORREDOR OESTE =====
    const west = new THREE.Group();
    west.position.set(-14, 0, 1);
    west.add(boxMesh(THREE, 10, 0.15, 4, matFloor, 0, -0.05, 0));
    addWall(THREE, west, 0, -2, 10, WALL_T, matWallD, 'cw_n');
    addWall(THREE, west, 0, 2, 10, WALL_T, matWallD, 'cw_s');
    // fim oeste + vão quarto
    addWall(THREE, west, -5, -0.8, WALL_T, 2.4, matWallD, 'cw_w_a');
    addWall(THREE, west, -5, 1.2, WALL_T, 1.6, matWallD, 'cw_w_b');
    west.add(boxMesh(THREE, 1.4, 2.3, 0.1, matDoor, -4.9, 1.15, 0));
    root.add(west);
    // colliders do corredor no world space
    addCollider(-14, -1, 10, 0.4, 'cw_n');
    addCollider(-14, 3, 10, 0.4, 'cw_s');
    addCollider(-19, 0.2, 0.4, 3.2, 'cw_w');

    // ===== QUARTO OESTE =====
    const wroom = new THREE.Group();
    wroom.position.set(-22, 0, 1);
    wroom.add(boxMesh(THREE, 8, 0.15, 8, matFloor, 0, -0.05, 0));
    addWall(THREE, wroom, 0, -4, 8, WALL_T, matWall, 'wr_n');
    addWall(THREE, wroom, 0, 4, 8, WALL_T, matWall, 'wr_s');
    addWall(THREE, wroom, -4, 0, WALL_T, 8, matWall, 'wr_w');
    addWall(THREE, wroom, 4, -2.5, WALL_T, 3, matWall, 'wr_e_n');
    addWall(THREE, wroom, 4, 2.5, WALL_T, 3, matWall, 'wr_e_s');
    // cama / cômoda low poly
    wroom.add(boxMesh(THREE, 2.2, 0.45, 3.2, new THREE.MeshLambertMaterial({ color: 0x4a2030, flatShading: true }), -1.5, 0.25, -1));
    wroom.add(boxMesh(THREE, 1.6, 1.1, 0.6, matTrim, 2, 0.55, -3));
    root.add(wroom);
    addCollider(-22, -3, 8, 0.4, 'wr_n');
    addCollider(-22, 5, 8, 0.4, 'wr_s');
    addCollider(-26, 1, 0.4, 8, 'wr_w');
    addCollider(-1.5 - 22, 0, 2.4, 3.4, 'cama'); // wrong - fix
    // fix bed collider in world: wroom at -22, bed local -1.5,-1
    COLLIDERS.pop();
    addCollider(-23.5, 0, 2.4, 3.4, 'cama');

    // ===== CORREDOR LESTE =====
    const east = new THREE.Group();
    east.position.set(14, 0, 1);
    east.add(boxMesh(THREE, 10, 0.15, 4, matFloor, 0, -0.05, 0));
    addWall(THREE, east, 0, -2, 10, WALL_T, matWallD, 'ce_n');
    addWall(THREE, east, 0, 2, 10, WALL_T, matWallD, 'ce_s');
    addWall(THREE, east, 5, -0.8, WALL_T, 2.4, matWallD, 'ce_e_a');
    addWall(THREE, east, 5, 1.2, WALL_T, 1.6, matWallD, 'ce_e_b');
    east.add(boxMesh(THREE, 1.4, 2.3, 0.1, matDoor, 4.9, 1.15, 0));
    root.add(east);
    addCollider(14, -1, 10, 0.4, 'ce_n');
    addCollider(14, 3, 10, 0.4, 'ce_s');
    addCollider(19, 0.2, 0.4, 3.2, 'ce_e');

    // ===== QUARTO LESTE (elite) =====
    const eroom = new THREE.Group();
    eroom.position.set(22, 0, 1);
    eroom.add(boxMesh(THREE, 8, 0.15, 8, matFloor, 0, -0.05, 0));
    addWall(THREE, eroom, 0, -4, 8, WALL_T, matWall, 'er_n');
    addWall(THREE, eroom, 0, 4, 8, WALL_T, matWall, 'er_s');
    addWall(THREE, eroom, 4, 0, WALL_T, 8, matWall, 'er_e');
    addWall(THREE, eroom, -4, -2.5, WALL_T, 3, matWall, 'er_w_n');
    addWall(THREE, eroom, -4, 2.5, WALL_T, 3, matWall, 'er_w_s');
    eroom.add(boxMesh(THREE, 0.8, 2.0, 0.8, new THREE.MeshLambertMaterial({ color: 0x8a8a90, flatShading: true }), 1.5, 1.0, -2));
    root.add(eroom);
    addCollider(22, -3, 8, 0.4, 'er_n');
    addCollider(22, 5, 8, 0.4, 'er_s');
    addCollider(26, 1, 0.4, 8, 'er_e');

    // ===== BECO (sul do hall) =====
    const beco = new THREE.Group();
    beco.position.set(0, 0, 12);
    beco.add(boxMesh(THREE, 4, 0.15, 8, matStone, 0, -0.05, 0));
    addWall(THREE, beco, -2, 0, WALL_T, 8, matWallD, 'beco_l');
    addWall(THREE, beco, 2, 0, WALL_T, 8, matWallD, 'beco_r');
    beco.add(boxMesh(THREE, 1.8, 2.4, 0.1, matDoor, 0, 1.2, 3.9));
    root.add(beco);
    addCollider(-2, 12, 0.45, 8, 'beco_l');
    addCollider(2, 12, 0.45, 8, 'beco_r');

    // ===== BAR (sul do beco) =====
    const bar = new THREE.Group();
    bar.position.set(0, 0, 20);
    bar.add(boxMesh(THREE, 12, 0.15, 8, matFloor, 0, -0.05, 0));
    addWall(THREE, bar, 0, -4, 12, WALL_T, matWall, 'bar_n');
    addWall(THREE, bar, 0, 4, 12, WALL_T, matWall, 'bar_s');
    addWall(THREE, bar, -6, 0, WALL_T, 8, matWall, 'bar_w');
    addWall(THREE, bar, 6, 0, WALL_T, 8, matWall, 'bar_e');
    // vão porta norte (do beco) — abrir no colisor norte
    // remove full north wall collider and split
    COLLIDERS.pop(); // remove bar_n full - actually last adds were w,e after n,s
    // Simpler: punch gap by not covering center
    // Rebuild bar north colliders manually
    // Find and we already added bar_n as full — fix:
    for (let i = COLLIDERS.length - 1; i >= 0; i--) {
      if (COLLIDERS[i].label === 'bar_n') COLLIDERS.splice(i, 1);
    }
    addCollider(-4, 16, 4, 0.4, 'bar_n_l');
    addCollider(4, 16, 4, 0.4, 'bar_n_r');
    // balcão
    bar.add(boxMesh(THREE, 6, 1.0, 0.8, matTrim, 0, 0.5, 1));
    addCollider(0, 21, 6.2, 1.0, 'balcao');
    root.add(bar);

    // Bounds gerais (não cair do mundo)
    addCollider(0, -10, 60, 1, 'bound_n');
    addCollider(0, 28, 60, 1, 'bound_s');
    addCollider(-30, 8, 1, 50, 'bound_w');
    addCollider(30, 8, 1, 50, 'bound_e');

    return root;
  }

  function collides(x, z, radius) {
    radius = radius || 0.35;
    for (let i = 0; i < COLLIDERS.length; i++) {
      const c = COLLIDERS[i];
      if (
        x + radius > c.min.x &&
        x - radius < c.max.x &&
        z + radius > c.min.z &&
        z - radius < c.max.z
      ) {
        return c;
      }
    }
    return null;
  }

  // Câmeras fixas por zona (estilo RE / PS1)
  const CAMERAS = {
    hall: {
      pos: { x: 0, y: 6.2, z: 11 },
      look: { x: 0, y: 1.2, z: 0 },
      zone: function (p) {
        return Math.abs(p.x) < 9 && p.z > -7 && p.z < 7.5;
      },
      name: 'Hall da Mansão',
    },
    hall_stairs: {
      pos: { x: 7, y: 4.5, z: -2 },
      look: { x: 0, y: 1.5, z: -5 },
      zone: function (p) {
        return Math.abs(p.x) < 9 && p.z <= -3.5 && p.z > -7;
      },
      name: 'Hall — Escadas',
    },
    west_corridor: {
      pos: { x: -10, y: 3.5, z: 6 },
      look: { x: -15, y: 1.2, z: 1 },
      zone: function (p) {
        return p.x < -9 && p.x > -19.5 && p.z > -1.5 && p.z < 3.5;
      },
      name: 'Corredor Oeste',
    },
    west_room: {
      pos: { x: -18, y: 4.5, z: 8 },
      look: { x: -22, y: 1.2, z: 1 },
      zone: function (p) {
        return p.x <= -19.5;
      },
      name: 'Quarto Oeste',
    },
    east_corridor: {
      pos: { x: 10, y: 3.5, z: 6 },
      look: { x: 15, y: 1.2, z: 1 },
      zone: function (p) {
        return p.x > 9 && p.x < 19.5 && p.z > -1.5 && p.z < 3.5;
      },
      name: 'Corredor Leste',
    },
    east_room: {
      pos: { x: 18, y: 4.5, z: 8 },
      look: { x: 22, y: 1.2, z: 1 },
      zone: function (p) {
        return p.x >= 19.5;
      },
      name: 'Quarto Leste',
    },
    beco: {
      pos: { x: 5, y: 3.2, z: 12 },
      look: { x: 0, y: 1.2, z: 14 },
      zone: function (p) {
        return Math.abs(p.x) < 2.2 && p.z >= 7.5 && p.z < 16;
      },
      name: 'Beco',
    },
    bar: {
      pos: { x: 0, y: 5.5, z: 27 },
      look: { x: 0, y: 1.2, z: 20 },
      zone: function (p) {
        return p.z >= 16;
      },
      name: 'Bar',
    },
  };

  global.EUPMap = {
    loadTextures: loadTextures,
    buildMap: buildMap,
    collides: collides,
    COLLIDERS: COLLIDERS,
    CAMERAS: CAMERAS,
    WALL_H: WALL_H,
  };
})(window);
