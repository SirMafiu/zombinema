import { gameEvents } from "./events";

const HUD_STYLES = `
  #hud-container {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 50;
    font-family: 'Courier New', Courier, monospace;
    color: white;
    text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.8);
  }

  #hud-round {
    position: absolute;
    top: 20px;
    left: 20px;
    font-size: 24px;
  }

  #hud-hp {
    position: absolute;
    top: 20px;
    right: 20px;
    font-size: 24px;
  }

  #hud-announcement {
    position: absolute;
    top: 40%;
    left: 50%;
    transform: translate(-50%, -50%);
    font-size: 64px;
    font-weight: bold;
    opacity: 0;
    transition: opacity 0.3s;
  }

  #hud-ammo {
    position: absolute;
    bottom: 20px;
    right: 20px;
    font-size: 28px;
    color: #ffffff;
  }

  #hud-reloading {
    position: absolute;
    top: 55%;
    left: 50%;
    transform: translateX(-50%);
    font-size: 22px;
    color: #ffcc00;
    opacity: 0;
    transition: opacity 0.15s;
  }

  #hud-powerup {
    position: absolute;
    bottom: 60px;
    left: 50%;
    transform: translateX(-50%);
    font-size: 22px;
    font-weight: bold;
    color: #00ff00;
    text-shadow: 0 0 10px #00ff00, 0 0 20px #00ff00;
    opacity: 0;
    transition: opacity 0.2s;
    text-align: center;
    white-space: nowrap;
  }

  #hud-powerup-vignette {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 49;
    box-shadow: inset 0 0 80px rgba(0, 255, 0, 0.3);
    opacity: 0;
    transition: opacity 0.3s;
  }

  #hud-gameover {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.75);
    display: none;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    pointer-events: auto;
    cursor: pointer;
  }

  #hud-gameover-title {
    font-size: 72px;
    font-weight: bold;
    color: #ff3333;
    margin-bottom: 20px;
  }

  #hud-gameover-round {
    font-size: 32px;
    margin-bottom: 40px;
  }

  #hud-gameover-restart {
    font-size: 24px;
    opacity: 0.8;
  }
`;

export class HUD {
  private roundEl: HTMLElement;
  private hpEl: HTMLElement;
  private announcementEl: HTMLElement;
  private gameoverEl: HTMLElement;
  private gameoverRoundEl: HTMLElement;
  private ammoEl: HTMLElement;
  private reloadingEl: HTMLElement;
  private powerupEl: HTMLElement;
  private vignetteEl: HTMLElement;
  private announcementTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    // Inject styles
    const style = document.createElement("style");
    style.textContent = HUD_STYLES;
    document.head.appendChild(style);

    // Create container
    const container = document.createElement("div");
    container.id = "hud-container";

    container.innerHTML = `
      <div id="hud-round">Round: 1</div>
      <div id="hud-hp">HP: 100</div>
      <div id="hud-ammo">12 / 12</div>
      <div id="hud-reloading">RELOADING...</div>
      <div id="hud-powerup"></div>
      <div id="hud-announcement"></div>
      <div id="hud-gameover">
        <div id="hud-gameover-title">GAME OVER</div>
        <div id="hud-gameover-round">You reached Round 1</div>
        <div id="hud-gameover-restart">Click to restart</div>
      </div>
    `;

    document.body.appendChild(container);

    // Vignette overlay (outside hud-container for its own z-index)
    const vignette = document.createElement("div");
    vignette.id = "hud-powerup-vignette";
    document.body.appendChild(vignette);

    this.roundEl = document.getElementById("hud-round")!;
    this.hpEl = document.getElementById("hud-hp")!;
    this.announcementEl = document.getElementById("hud-announcement")!;
    this.gameoverEl = document.getElementById("hud-gameover")!;
    this.gameoverRoundEl = document.getElementById("hud-gameover-round")!;
    this.ammoEl = document.getElementById("hud-ammo")!;
    this.reloadingEl = document.getElementById("hud-reloading")!;
    this.powerupEl = document.getElementById("hud-powerup")!;
    this.vignetteEl = vignette;

    // Subscribe to game events
    gameEvents.on("roundChanged", (data) => {
      this.updateRound(data.round);
      this.showAnnouncement(`Round ${data.round}`);
    });

    gameEvents.on("playerDamaged", (data) => {
      if (data.currentHp >= 0) {
        this.updateHP(data.currentHp);
      }
    });

    gameEvents.on("playerDied", (data) => {
      this.showGameOver(data.round);
    });

    gameEvents.on("powerupCollected", (data) => {
      if (data.type === "compilateur") {
        this.showPowerUp(true);
      }
    });

    gameEvents.on("powerupExpired", (data) => {
      if (data.type === "compilateur") {
        this.showPowerUp(false);
      }
    });
  }

  private updateRound(round: number): void {
    this.roundEl.textContent = `Round: ${round}`;
  }

  private updateHP(hp: number): void {
    this.hpEl.textContent = `HP: ${hp}`;
    if (hp > 60) {
      this.hpEl.style.color = "#33ff33";
    } else if (hp > 30) {
      this.hpEl.style.color = "#ffff33";
    } else {
      this.hpEl.style.color = "#ff3333";
    }
  }

  private showAnnouncement(text: string): void {
    if (this.announcementTimeout) {
      clearTimeout(this.announcementTimeout);
    }
    this.announcementEl.textContent = text;
    this.announcementEl.style.opacity = "1";

    this.announcementTimeout = setTimeout(() => {
      this.announcementEl.style.opacity = "0";
      this.announcementTimeout = null;
    }, 2000);
  }

  updateAmmo(current: number, max: number): void {
    this.ammoEl.textContent = `${current} / ${max}`;
    if (current === 0) {
      this.ammoEl.style.color = "#ff3333";
    } else if (current <= 4) {
      this.ammoEl.style.color = "#ffcc00";
    } else {
      this.ammoEl.style.color = "#ffffff";
    }
  }

  showReloading(visible: boolean): void {
    this.reloadingEl.style.opacity = visible ? "1" : "0";
  }

  private showPowerUp(active: boolean): void {
    this.powerupEl.style.opacity = active ? "1" : "0";
    this.vignetteEl.style.opacity = active ? "1" : "0";
    if (!active) {
      this.powerupEl.textContent = "";
    }
  }

  updatePowerUpTimer(remainingMs: number): void {
    if (remainingMs > 0) {
      const seconds = Math.ceil(remainingMs / 1000);
      this.powerupEl.textContent = `COMPILATEUR ACTIF — ${seconds}s`;
    }
  }

  private showGameOver(round: number): void {
    this.gameoverRoundEl.textContent = `You reached Round ${round}`;
    this.gameoverEl.style.display = "flex";

    this.gameoverEl.addEventListener("click", () => {
      window.location.reload();
    });
  }
}
