import Phaser, { Math as pMath, Scene } from "phaser";
import { InterpolationBuffer } from "interpolation-buffer";
import { HathoraClient, HathoraConnection } from "@hathora/client-sdk";

import { Bullet, SessionMetadata, GameState, Player } from "../../../common/types";
import { ClientMessageType, ServerMessageType } from "../../../common/messages";
import map from "../../../common/map.json";

const BULLETS_MAX = 3;

export class GameScene extends Scene {
  private preloaderContainer!: HTMLDivElement;
  private preloaderBar!: HTMLDivElement;

  // A variable to represent our RoomConnection instance
  private connection: HathoraConnection | undefined;
  private token: string | undefined;
  private sessionMetadata: SessionMetadata | undefined;

  // The buffer which holds state snapshots
  private stateBuffer: InterpolationBuffer<GameState> | undefined;
  // A map of player sprites currently connected
  private player: Map<string, Phaser.GameObjects.Sprite> = new Map();
  private playersName: Map<string, Phaser.GameObjects.Text> = new Map();
  private playersAmmo: Map<string, Phaser.GameObjects.Text> = new Map();
  // A map of bullet sprites currently in-air
  private bullets: Map<number, Phaser.GameObjects.Sprite> = new Map();
  // The Hathora user for the current client's connected player
  private currentUserID: string | undefined;
  // The current client's connected player's sprite object
  private playerSprite: Phaser.GameObjects.Sprite | undefined;
  // The previous tick's aim radians (used to check if aim has changed, before sending an update)
  private prevAimRad = 0;
  // Ammo indicator assets
  private ammos: Map<number, Phaser.GameObjects.Image> = new Map();
  private reloading: Phaser.GameObjects.Text | undefined = undefined;
  private leaderBoard: Map<string, Phaser.GameObjects.Text> = new Map();
  private dash: Phaser.GameObjects.Text | undefined = undefined;
  private respawnText: Phaser.GameObjects.Text | undefined = undefined;
  private endText: Phaser.GameObjects.Text | undefined = undefined;
  private disconnectText: Phaser.GameObjects.Text | undefined = undefined;

  static NAME = "scene-game";

  constructor() {
    super(GameScene.NAME);
  }

  // Called immediately after the constructor, this function is used to preload assets
  preload() {
    // Load our assets from before
    this.load.image("bullet", "bullet.png");
    this.load.image("player", "player.png");
    this.load.image("p0_reload", "p0_reload.png");
    this.load.image("p1_reload", "p1_reload.png");
    this.load.image("p2_reload", "p2_reload.png");
    this.load.image("p3_reload", "p3_reload.png");
    this.load.image("p4_reload", "p4_reload.png");
    this.load.image("p5_reload", "p5_reload.png");
    this.load.image("p6_reload", "p6_reload.png");
    this.load.image("p7_reload", "p7_reload.png");
    this.load.image("p8_reload", "p8_reload.png");
    this.load.image("p0", "p0.png");
    this.load.image("p1", "p1.png");
    this.load.image("p2", "p2.png");
    this.load.image("p3", "p3.png");
    this.load.image("p4", "p4.png");
    this.load.image("p5", "p5.png");
    this.load.image("p6", "p6.png");
    this.load.image("p7", "p7.png");
    this.load.image("p8", "p8.png");
    this.load.image("wall", "wall.png");
    this.load.image("wall_red", "wall_red.png");
    this.load.image("wall_blue", "wall_blue.png");
    this.load.image("wall", "wall.png");
    this.load.image("grass", "grass.png");
    this.load.image("floor", "floor.png");
    this.load.image("splash", "splash.png");
  }

  init({
    connection,
    token,
    sessionMetadata,
  }: {
    connection: HathoraConnection;
    token: string;
    sessionMetadata: SessionMetadata;
  }) {
    // Receive connection and user data from BootScene
    this.connection = connection;
    this.token = token;
    this.sessionMetadata = sessionMetadata;

    const currentUser = HathoraClient.getUserFromToken(token);
    this.currentUserID = currentUser.id;
  }

  bindPreloaderDOM() {
    this.preloaderContainer = document.querySelector(".preloader") as HTMLDivElement;
    this.preloaderBar = this.preloaderContainer.querySelector(".preloader__bar-inner") as HTMLDivElement;
    this.preloaderContainer.classList.remove("off");
  }

  setPreloaderPercentage(p: number) {
    if (p === 1) {
      this.preloaderContainer.classList.add("off");
    }

    this.preloaderBar.style.width = `${p * 100}%`;
  }

  create() {
    this.bindPreloaderDOM();

    this.setPreloaderPercentage(0.1);

    this.setPreloaderPercentage(0.2);
    // Set the main camera's background colour and bounding box

    // Display metadata
    const _roomId = this.add
      .text(300, 4, `Room ID:${this.sessionMetadata?.roomId ?? ""}`, { color: "white" })
      .setAlpha(0.8)
      .setScrollFactor(0);
    const _serverUrl = this.add
      .text(4, 4, this.sessionMetadata?.serverUrl ?? "", { color: "white" })
      .setAlpha(0.8)
      .setScrollFactor(0);
    const _region = this.add.text(4, 20, this.sessionMetadata?.region ?? "", { color: "white" }).setScrollFactor(0);

    // Ping indicator
    const pingText = this.add.text(4, 36, "Ping:", { color: "white" }).setScrollFactor(0);
    const pings: number[] = [];


    map.wallsRed.forEach(({ x, y, width, height }) => {
      this.add.tileSprite(x, y, width, height, "wall_red").setOrigin(0, 0);
    });

    this.setPreloaderPercentage(0.3);
    // Dash indicator
    this.setPreloaderPercentage(0.4);

    this.setPreloaderPercentage(0.5);

    this.setPreloaderPercentage(0.6);

    this.connection?.onMessageJson((msg) => {
      switch (msg.type) {
        case ServerMessageType.StateUpdate:
          // Start enqueuing state updates
          if (this.stateBuffer === undefined) {
            this.stateBuffer = new InterpolationBuffer(msg.state, 50, lerp);
          } else {
            this.stateBuffer.enqueue(msg.state, [], msg.ts);
          }
          break;
        case ServerMessageType.PingResponse:
          // Update ping text
          pings.push(Date.now() - msg.id);
          if (pings.length > 2) {
            pings.shift();
          }
          pingText.text = `Ping: ${[...pings].sort((a, b) => a - b)[Math.floor(pings.length / 2)]}`;
          break;
      }
    });
    this.setPreloaderPercentage(0.7);

    this.token != null ? this.connection?.connect(this.token) : {};

    // Send pings every 500ms
    setInterval(() => {
      this.connection?.writeJson({ type: ClientMessageType.Ping, id: Date.now() });
    }, 1000);

    // Handle keyboard input
    const keys = this.input.keyboard.addKeys("W,S,A,D") as {
      W: Phaser.Input.Keyboard.Key;
      S: Phaser.Input.Keyboard.Key;
      A: Phaser.Input.Keyboard.Key;
      D: Phaser.Input.Keyboard.Key;
    };
    const keySpace = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    const keyR = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.R);
    let prevDirection = {
      x: 0,
      y: 0,
    };
    this.setPreloaderPercentage(0.8);

    const handleKeyEvt = () => {
      const direction = {
        x: 0,
        y: 0,
      };
      if (keys.W.isDown) {
        direction.y = -1;
      } else if (keys.S.isDown) {
        direction.y = 1;
      } else {
        direction.y = 0;
      }

      if (keys.D.isDown) {
        direction.x = 1;
      } else if (keys.A.isDown) {
        direction.x = -1;
      } else {
        direction.x = 0;
      }

      if (prevDirection.x !== direction.x || prevDirection.y !== direction.y) {
        // If connection is open and direction has changed, send updated direction
        prevDirection = direction;
        this.connection?.writeJson({ type: ClientMessageType.SetDirection, direction });
      }

      if (keySpace.isDown) {
        this.connection?.writeJson({ type: ClientMessageType.Jump });
      }
    };
    this.setPreloaderPercentage(0.9);

    this.input.keyboard.on("keydown", handleKeyEvt);
    this.input.keyboard.on("keyup", handleKeyEvt);

    this.setPreloaderPercentage(0.95);
    setTimeout(() => {
      this.setPreloaderPercentage(1);
    }, 400);
  }

  update() {
    // If the stateBuffer hasn't been defined, skip this update tick
    if (this.stateBuffer === undefined) {
      return;
    }

    const { state } = this.stateBuffer.getInterpolatedState(Date.now());


    // Synchronize the players in our game's state with sprites to represent them graphically
    if (this.playerSprite === undefined) {
      console.log("Creating player sprite");
      this.playerSprite = this.add.sprite(
        state.player.position.x,
        state.player.position.y,
        "p0"
      );
    } else {
      this.playerSprite.setPosition(state.player.position.x, state.player.position.y);
    }
    console.log("camera: ", this.cameras.main.x, this.cameras.main.y);
    console.log("sprite: ", this.playerSprite.x, this.playerSprite.y, this.playerSprite.texture);
  }
}

function lerp(from: GameState, to: GameState, pctElapsed: number): GameState {
  return {
    player: lerpPlayer(from.player, to.player, pctElapsed)
  };
}

function lerpPlayer(from: Player, to: Player, pctElapsed: number): Player {
  return {
    id: to.id,
    position: {
      x: from.position.x + (to.position.x - from.position.x) * pctElapsed,
      y: from.position.y + (to.position.y - from.position.y) * pctElapsed,
    },
    sprite: to.sprite,
  };
}
