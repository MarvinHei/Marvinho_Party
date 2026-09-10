import Phaser from "phaser";

export interface BoardPlayer {
  id: string;
  nickname: string;
  color: string;
  position: number;
  ready: boolean;
}

export interface BoardState {
  boardLength: number;
  players: BoardPlayer[];
  meId: string | null;
}

interface Token {
  root: Phaser.GameObjects.Container; // moves along the board
  avatar: Phaser.GameObjects.Container; // bobs in place
  eyes: Phaser.GameObjects.Container[];
  crown: Phaser.GameObjects.Text;
  badge: Phaser.GameObjects.Container;
  size: number;
  lastPosition: number;
  bob: Phaser.Tweens.Tween; // idle bob, paused while hopping
  hopping: boolean;
}

// --- small color helpers ----------------------------------------------------
function toNum(hex: string): number {
  return Phaser.Display.Color.HexStringToColor(hex).color;
}
function shade(hex: string, amount: number): number {
  const c = Phaser.Display.Color.HexStringToColor(hex);
  if (amount >= 0) c.lighten(amount * 100);
  else c.darken(-amount * 100);
  return c.color;
}

// Remembers each player's last rendered board tile ACROSS board remounts (the
// board is torn down during each minigame). This lets the forward-hop animation
// play when the board reappears after a game, instead of tokens snapping into
// place. Module-level so it survives the React unmount/remount of PhaserBoard.
const REMEMBERED_POSITIONS = new Map<string, number>();

/**
 * Renders the board and animates player characters. Static art (tiles, path,
 * decorations) is rebuilt only when the size or board length changes; player
 * tokens are reused and tweened, which keeps movement smooth.
 */
export class BoardScene extends Phaser.Scene {
  private state: BoardState | null = null;
  private ready = false;

  private tilePoints: Phaser.Math.Vector2[] = [];
  private tileSize = 44;
  private builtKey = "";

  private deco!: Phaser.GameObjects.Container;
  private pathGfx!: Phaser.GameObjects.Graphics;
  private tileGfx!: Phaser.GameObjects.Graphics;
  private tileLabels!: Phaser.GameObjects.Container;
  private tokenLayer!: Phaser.GameObjects.Container;
  private ambient?: Phaser.GameObjects.Particles.ParticleEmitter;

  private tokens = new Map<string, Token>();
  private resizeTimer?: Phaser.Time.TimerEvent;

  constructor() {
    super("board");
  }

  create() {
    this.ready = true;
    this.makeTextures();

    this.deco = this.add.container(0, 0).setDepth(0);
    this.pathGfx = this.add.graphics().setDepth(1);
    this.tileGfx = this.add.graphics().setDepth(2);
    this.tileLabels = this.add.container(0, 0).setDepth(3);
    this.tokenLayer = this.add.container(0, 0).setDepth(10);

    // Debounce resize so a settling flex layout doesn't rebuild every frame.
    this.scale.on("resize", () => {
      this.resizeTimer?.remove();
      this.resizeTimer = this.time.delayedCall(120, () => {
        this.builtKey = ""; // force rebuild at the new size
        if (this.state) this.render(this.state);
      });
    });

    if (this.state) this.render(this.state);
  }

  setBoard(state: BoardState) {
    this.state = state;
    if (this.ready) this.render(state);
  }

  private makeTextures() {
    if (!this.textures.exists("spark")) {
      const g = this.make.graphics({ x: 0, y: 0 }, false);
      g.fillStyle(0xffffff, 1);
      g.fillRect(0, 0, 4, 4);
      g.generateTexture("spark", 4, 4);
      g.destroy();
    }
    if (!this.textures.exists("dot")) {
      const g = this.make.graphics({ x: 0, y: 0 }, false);
      g.fillStyle(0xffffff, 1);
      g.fillCircle(4, 4, 4);
      g.generateTexture("dot", 8, 8);
      g.destroy();
    }
  }

  // --- layout -------------------------------------------------------------

  private computeLayout(count: number) {
    const W = this.scale.width;
    const H = this.scale.height;
    const marginX = 54;
    const marginTop = 54;
    const marginBottom = 54;
    const gap = 16;

    let perRow = Math.max(4, Math.floor((W - marginX * 2) / (this.tileSize + gap)));
    perRow = Math.min(perRow, count);
    const rows = Math.ceil(count / perRow);

    const usableW = W - marginX * 2;
    const usableH = H - marginTop - marginBottom;
    const cellW = usableW / perRow;
    const rowH = usableH / rows;
    this.tileSize = Math.max(26, Math.min(58, Math.min(cellW, rowH) - gap));

    this.tilePoints = [];
    for (let i = 0; i < count; i++) {
      const row = Math.floor(i / perRow);
      let col = i % perRow;
      if (row % 2 === 1) col = perRow - 1 - col; // snake direction
      const x = marginX + cellW * col + cellW / 2;
      const y = marginTop + rowH * row + rowH / 2;
      this.tilePoints.push(new Phaser.Math.Vector2(x, y));
    }
  }

  // --- rendering ----------------------------------------------------------

  private render(state: BoardState) {
    const count = state.boardLength + 1;
    const key = `${Math.round(this.scale.width)}x${Math.round(this.scale.height)}x${count}`;
    if (key !== this.builtKey) {
      this.computeLayout(count);
      this.rebuildStatic(count);
      this.builtKey = key;
      // Size changed: rebuild tokens from scratch at their tiles.
      for (const t of this.tokens.values()) t.root.destroy();
      this.tokens.clear();
    }
    this.updateTokens(state);
  }

  private rebuildStatic(count: number) {
    this.buildDecor();
    this.drawPath(count);
    this.drawTiles(count);
    this.buildAmbient();
  }

  private buildDecor() {
    this.deco.removeAll(true);
    const W = this.scale.width;
    const H = this.scale.height;
    // Twinkling background stars.
    const n = Math.min(40, Math.floor((W * H) / 22000));
    for (let i = 0; i < n; i++) {
      const x = Phaser.Math.Between(8, W - 8);
      const y = Phaser.Math.Between(8, H - 8);
      const s = Phaser.Math.Between(1, 3);
      const star = this.add.rectangle(x, y, s, s, 0xffffff, 0.7);
      this.deco.add(star);
      this.tweens.add({
        targets: star,
        alpha: 0.1,
        duration: Phaser.Math.Between(1200, 2600),
        yoyo: true,
        repeat: -1,
        delay: Phaser.Math.Between(0, 1500),
        ease: "Sine.easeInOut",
      });
    }
  }

  private drawPath(count: number) {
    this.pathGfx.clear();
    // Outer ribbon.
    this.pathGfx.lineStyle(Math.max(8, this.tileSize * 0.28), 0x2a2560, 1);
    this.strokeThrough(count);
    // Inner dashed guide.
    this.pathGfx.lineStyle(Math.max(2, this.tileSize * 0.06), 0x6f66c0, 0.8);
    this.strokeThrough(count);
  }

  private strokeThrough(count: number) {
    this.pathGfx.beginPath();
    for (let i = 0; i < count; i++) {
      const p = this.tilePoints[i];
      if (i === 0) this.pathGfx.moveTo(p.x, p.y);
      else this.pathGfx.lineTo(p.x, p.y);
    }
    this.pathGfx.strokePath();
  }

  private drawTiles(count: number) {
    this.tileGfx.clear();
    this.tileLabels.removeAll(true);
    const s = this.tileSize;
    const r = Math.max(6, s * 0.22);

    for (let i = 0; i < count; i++) {
      const p = this.tilePoints[i];
      const isStart = i === 0;
      const isFinish = i === count - 1;

      const base =
        isStart ? "#2fa85e" : isFinish ? "#c9a300" : i % 2 === 0 ? "#3a3480" : "#332d70";
      const top = isStart ? "#42d17a" : isFinish ? "#ffd23f" : i % 2 === 0 ? "#4b44a0" : "#443c90";

      // Drop shadow.
      this.tileGfx.fillStyle(0x0d0b22, 0.55);
      this.tileGfx.fillRoundedRect(p.x - s / 2, p.y - s / 2 + 5, s, s, r);
      // Base (darker) + top face for a chunky 3D look.
      this.tileGfx.fillStyle(shade(base, -0.05), 1);
      this.tileGfx.fillRoundedRect(p.x - s / 2, p.y - s / 2 + 3, s, s, r);
      this.tileGfx.fillStyle(toNum(top), 1);
      this.tileGfx.fillRoundedRect(p.x - s / 2, p.y - s / 2, s, s, r);
      // Glossy top highlight.
      this.tileGfx.fillStyle(0xffffff, 0.16);
      this.tileGfx.fillRoundedRect(p.x - s / 2 + 4, p.y - s / 2 + 3, s - 8, s * 0.34, r * 0.6);

      const labelText = isStart ? "GO" : isFinish ? "★" : String(i);
      const label = this.add
        .text(p.x, p.y, labelText, {
          fontFamily: '"Press Start 2P", monospace',
          fontSize: `${Math.max(8, Math.floor(s * (isFinish ? 0.42 : 0.26)))}px`,
          color: isFinish || isStart ? "#14122e" : "#dcd6ff",
        })
        .setOrigin(0.5);
      this.tileLabels.add(label);

      if (isFinish) this.addFinishGlow(p, s, label);
    }
  }

  private addFinishGlow(p: Phaser.Math.Vector2, s: number, label: Phaser.GameObjects.Text) {
    const glow = this.add.image(p.x, p.y, "dot").setTint(0xffd23f).setDepth(1);
    glow.setDisplaySize(s * 2, s * 2).setAlpha(0.35);
    this.deco.add(glow);
    this.tweens.add({
      targets: glow,
      alpha: 0.08,
      scale: glow.scale * 1.35,
      duration: 1100,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
    // Gentle star pulse.
    this.tweens.add({
      targets: label,
      scale: 1.18,
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
  }

  private buildAmbient() {
    this.ambient?.destroy();
    const W = this.scale.width;
    const H = this.scale.height;
    this.ambient = this.add.particles(0, 0, "spark", {
      x: { min: 0, max: W },
      y: H + 6,
      lifespan: 6000,
      speedY: { min: -22, max: -10 },
      speedX: { min: -6, max: 6 },
      scale: { start: 1.4, end: 0 },
      alpha: { start: 0.5, end: 0 },
      frequency: 260,
      tint: [0x7a5aff, 0x3aa0ff, 0xff6fcf],
    });
    this.ambient.setDepth(0);
  }

  // --- tokens -------------------------------------------------------------

  private tokenOffset(index: number, total: number): { dx: number; dy: number } {
    if (total <= 1) return { dx: 0, dy: 0 };
    const angle = (index / total) * Math.PI * 2 - Math.PI / 2;
    const rad = Math.min(this.tileSize * 0.42, 16);
    return { dx: Math.cos(angle) * rad, dy: Math.sin(angle) * rad };
  }

  private createToken(player: BoardPlayer, isMe: boolean): Token {
    const size = Math.max(20, this.tileSize * 0.62);
    const color = toNum(player.color);

    const shadow = this.add.ellipse(0, size * 0.52, size * 0.95, size * 0.34, 0x000000, 0.32);

    // Body drawn as a rounded character with depth + belly highlight.
    const g = this.add.graphics();
    const bw = size;
    const bh = size;
    const br = size * 0.34;
    g.fillStyle(shade(player.color, -0.28), 1);
    g.fillRoundedRect(-bw / 2, -bh / 2 + 3, bw, bh, br);
    g.fillStyle(color, 1);
    g.fillRoundedRect(-bw / 2, -bh / 2, bw, bh, br);
    g.fillStyle(shade(player.color, 0.35), 0.55);
    g.fillRoundedRect(-bw / 2 + bw * 0.16, -bh / 2 + bh * 0.12, bw * 0.68, bh * 0.34, br * 0.7);
    g.lineStyle(3, 0x0d0b22, 1);
    g.strokeRoundedRect(-bw / 2, -bh / 2, bw, bh, br);

    const makeEye = (ex: number) => {
      const white = this.add.circle(0, 0, size * 0.13, 0xffffff);
      const pupil = this.add.circle(size * 0.03, size * 0.02, size * 0.06, 0x14122e);
      const glint = this.add.circle(-size * 0.03, -size * 0.03, size * 0.02, 0xffffff);
      const eye = this.add.container(ex, -size * 0.06, [white, pupil, glint]);
      return eye;
    };
    const eyeL = makeEye(-size * 0.18);
    const eyeR = makeEye(size * 0.18);
    const mouth = this.add.rectangle(0, size * 0.2, size * 0.22, size * 0.05, 0x14122e).setAlpha(0.7);

    const crown = this.add
      .text(0, -size * 0.74, "👑", { fontSize: `${Math.max(12, Math.floor(size * 0.44))}px` })
      .setOrigin(0.5)
      .setVisible(false);

    const avatar = this.add.container(0, 0, [g, eyeL, eyeR, mouth, crown]);

    // Ready badge (green circle + drawn check) at the top-right.
    const badgeBg = this.add.circle(0, 0, size * 0.22, 0x42d17a).setStrokeStyle(2, 0x0d0b22);
    const tick = this.add.graphics();
    tick.lineStyle(Math.max(2, size * 0.05), 0x08240f, 1);
    tick.beginPath();
    tick.moveTo(-size * 0.09, 0);
    tick.lineTo(-size * 0.02, size * 0.07);
    tick.lineTo(size * 0.1, -size * 0.08);
    tick.strokePath();
    const badge = this.add
      .container(size * 0.44, -size * 0.44, [badgeBg, tick])
      .setVisible(false);

    const name = this.add
      .text(0, -size * 0.95, isMe ? "YOU" : player.nickname, {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: "8px",
        color: isMe ? "#ffd23f" : "#f4f1ff",
        stroke: "#0d0b22",
        strokeThickness: 3,
      })
      .setOrigin(0.5, 1);

    const root = this.add.container(0, 0, [shadow, avatar, badge, name]);
    this.tokenLayer.add(root);

    // Idle: bob + breathing, desynced per token.
    const phase = Math.random() * 1000;
    const bob = this.tweens.add({
      targets: avatar,
      y: -size * 0.14,
      duration: 950,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
      delay: phase,
    });
    this.tweens.add({
      targets: shadow,
      scaleX: 0.8,
      scaleY: 0.8,
      duration: 950,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
      delay: phase,
    });
    // Idle: occasional blink.
    for (const eye of [eyeL, eyeR]) {
      this.tweens.add({
        targets: eye,
        scaleY: 0.1,
        duration: 90,
        yoyo: true,
        repeat: -1,
        repeatDelay: Phaser.Math.Between(1800, 3200),
        delay: Phaser.Math.Between(0, 1200),
        ease: "Quad.easeInOut",
      });
    }

    return { root, avatar, eyes: [eyeL, eyeR], crown, badge, size, lastPosition: player.position, bob, hopping: false };
  }

  private updateTokens(state: BoardState) {
    // Group players per tile so overlapping tokens fan out.
    const byTile = new Map<number, string[]>();
    for (const p of state.players) {
      const arr = byTile.get(p.position) ?? [];
      arr.push(p.id);
      byTile.set(p.position, arr);
    }
    const maxPos = Math.max(0, ...state.players.map((p) => p.position));

    const seen = new Set<string>();
    for (const player of state.players) {
      seen.add(player.id);
      const tileIndex = Math.min(player.position, this.tilePoints.length - 1);
      const base = this.tilePoints[tileIndex];
      const group = byTile.get(player.position)!;
      const { dx, dy } = this.tokenOffset(group.indexOf(player.id), group.length);
      const tx = base.x + dx;
      const ty = base.y + dy;

      let token = this.tokens.get(player.id);
      if (!token) {
        token = this.createToken(player, player.id === state.meId);
        this.tokens.set(player.id, token);
        // The board unmounts during each minigame; if this player advanced while
        // it was hidden, start them on their old tile and hop forward so the
        // "moving up the board" animation still plays after the game.
        const prev = REMEMBERED_POSITIONS.get(player.id);
        if (prev !== undefined && prev !== player.position) {
          const prevIdx = Math.min(prev, this.tilePoints.length - 1);
          const pp = this.tilePoints[prevIdx];
          token.root.setPosition(pp.x, pp.y);
          token.lastPosition = prev;
          this.hopForward(token, prev, player.position, tx, ty, toNum(player.color));
        } else {
          token.root.setPosition(tx, ty);
        }
      } else if (player.position !== token.lastPosition) {
        // Springy tile-by-tile hop toward the new position (board-game style).
        this.hopForward(token, token.lastPosition, player.position, tx, ty, toNum(player.color));
      } else {
        // Same tile, maybe a re-fan after grouping changed.
        this.tweens.add({ targets: token.root, x: tx, y: ty, duration: 220, ease: "Sine.easeInOut" });
      }
      token.lastPosition = player.position;
      REMEMBERED_POSITIONS.set(player.id, player.position);

      const isLeader = player.position > 0 && player.position === maxPos;
      token.crown.setVisible(isLeader);
      token.badge.setVisible(player.ready);
      token.root.setDepth(10 + player.position); // ahead players draw on top
    }

    for (const [id, token] of this.tokens) {
      if (!seen.has(id)) {
        token.root.destroy();
        this.tokens.delete(id);
      }
    }
  }

  /**
   * Hop a token forward one tile at a time with a springy jump on each step,
   * landing with a squash-and-stretch. Used after every minigame as characters
   * advance across the board.
   */
  private hopForward(
    token: Token,
    from: number,
    to: number,
    finalX: number,
    finalY: number,
    color: number,
  ) {
    // Build the list of tiles to land on (each hop = one tile).
    const steps: { x: number; y: number }[] = [];
    if (to > from) {
      for (let pos = from + 1; pos <= to; pos++) {
        const idx = Math.min(pos, this.tilePoints.length - 1);
        const p = this.tilePoints[idx];
        steps.push(pos === to ? { x: finalX, y: finalY } : { x: p.x, y: p.y });
      }
    } else {
      steps.push({ x: finalX, y: finalY }); // moved back (rare) — one settle
    }

    const n = steps.length;
    // Keep the whole advance snappy regardless of distance.
    const per = Math.max(150, Math.min(300, Math.round(1500 / n)));
    const hop = token.size * 0.7;

    // Pause the idle bob so it doesn't fight the jump on avatar.y.
    if (!token.hopping) {
      token.hopping = true;
      token.bob.pause();
    }

    const chain = steps.map((s, i) => ({
      targets: token.root,
      x: s.x,
      y: s.y,
      duration: per,
      ease: "Sine.easeInOut",
      onStart: () => {
        // Jump arc (up then down) synced to this hop.
        this.tweens.add({
          targets: token.avatar,
          y: -hop,
          duration: per / 2,
          yoyo: true,
          ease: "Quad.easeOut",
        });
      },
      onComplete: () => {
        // Spring squash on landing.
        token.avatar.setScale(1.18, 0.82);
        this.tweens.add({
          targets: token.avatar,
          scaleX: 1,
          scaleY: 1,
          duration: 220,
          ease: "Back.easeOut",
        });
        if (i === n - 1) this.burst(s.x, s.y, color);
      },
    }));

    this.tweens.chain({
      tweens: chain,
      onComplete: () => {
        // Settle the avatar and resume the idle bob.
        token.avatar.y = 0;
        token.avatar.setScale(1, 1);
        token.hopping = false;
        token.bob.restart();
      },
    });
  }

  private burst(x: number, y: number, color: number) {
    const emitter = this.add.particles(x, y, "spark", {
      speed: { min: 60, max: 170 },
      angle: { min: 0, max: 360 },
      scale: { start: 1.8, end: 0 },
      lifespan: 480,
      quantity: 14,
      tint: [color, 0xffffff],
      emitting: false,
    });
    emitter.setDepth(60);
    emitter.explode(14, x, y);
    this.time.delayedCall(650, () => emitter.destroy());
  }
}
