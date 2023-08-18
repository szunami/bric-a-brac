import Phaser, { Math as pMath, Scene } from "phaser";
import { InterpolationBuffer } from "interpolation-buffer";
import { HathoraClient, HathoraConnection } from "@hathora/client-sdk";

import { SessionMetadata, GameState, Player, Ball, Brick, BrickType } from "../../../common/types";
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
  private bricks: Map<number, Phaser.GameObjects.Sprite> = new Map();
  private balls: Map<number, Phaser.GameObjects.Sprite> = new Map();
  private balls2: Map<number, Phaser.GameObjects.Sprite> = new Map();
  private balls3: Map<number, Phaser.GameObjects.Sprite> = new Map();
  // The Hathora user for the current client's connected player
  private currentUserID: string | undefined;
  // The current client's connected player's sprite object
  private player1Sprite: Phaser.GameObjects.Sprite | undefined;
  private player2Sprite: Phaser.GameObjects.Sprite | undefined;

  private player1Score: Phaser.GameObjects.Text | undefined = undefined;
  private player2Score: Phaser.GameObjects.Text | undefined = undefined;

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

  private gameState: Phaser.GameObjects.Text | undefined;


  constructor() {
    super(GameScene.NAME);
  }

  // Called immediately after the constructor, this function is used to preload assets
  preload() {
    this.load.image("paddle", "paddle.png");
    this.load.image("brick", "brick.png");
    this.load.image("special_brick", "special_brick.png");
    this.load.image("bullet", "bullet.png");
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
    console.debug(`GameScene init`);

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

    this.cameras.main.setBackgroundColor("#172038");
    const graphics = this.add.graphics();
    graphics.fillStyle(0x819796);
    graphics.fillRect(-128, -220, 256, 220)

    graphics.fillStyle(0xa8b5b2);
    graphics.fillRect(-128, 0, 256, 220)

    this.bindPreloaderDOM();

    this.setPreloaderPercentage(0.1);

    this.setPreloaderPercentage(0.2);
    // Set the main camera's background colour and bounding box

    // Display metadata
    const _roomId = this.add
      .text(4, 4, `Room ID:${this.sessionMetadata?.roomId ?? ""}`, { color: "white" })
      .setAlpha(0.8)
      .setScrollFactor(0);
    const _serverUrl = this.add
      .text(4, 20, this.sessionMetadata?.serverUrl ?? "", { color: "white" })
      .setAlpha(0.8)
      .setScrollFactor(0);
    const _region = this.add.text(4, 36, this.sessionMetadata?.region ?? "", { color: "white" }).setScrollFactor(0);

    // Ping indicator
    const pingText = this.add.text(4, 52, "Ping:", { color: "white" }).setScrollFactor(0);
    const pings: number[] = [];

    this.gameState = this.add.text(250, 250, "Press space when you're ready", { color: "#ebede9", align: "center" }).setScrollFactor(0);

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
    const keys = this.input.keyboard.addKeys("W,S,A,D,SPACE") as {
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
        this.connection?.writeJson({ type: ClientMessageType.SetReady });
      }
    };
    this.setPreloaderPercentage(0.9);

    this.input.keyboard.on("keydown", handleKeyEvt);
    this.input.keyboard.on("keyup", handleKeyEvt);

    this.setPreloaderPercentage(0.95);
    setTimeout(() => {
      this.setPreloaderPercentage(1);
    }, 400);

    this.cameras.main.setBounds(-400, -300, 800, 600);
  }




  update() {

    // If the stateBuffer hasn't been defined, skip this update tick
    if (this.stateBuffer === undefined) {
      return;
    }

    const { state } = this.stateBuffer.getInterpolatedState(Date.now());

    console.log(state.player1.ready, state.player2.ready);

    if (state.player1.id === this.currentUserID) {
      if (!state.player1.ready) {
        this.gameState?.setText("Press space when you're ready");
      } else if (!state.player2.ready) {
        this.gameState?.setText("Waiting on other player");
      } else {
        this.gameState?.setText("");
      }
    }

    if (state.player2.id === this.currentUserID) {
      if (!state.player2.ready) {
        this.gameState?.setText("Press space when you're ready");
      } else if (!state.player1.ready) {
        this.gameState?.setText("Waiting on other player");
      } else {
        this.gameState?.setText("");
      }
    }

    state.balls.forEach(ball => {
      if (!this.balls3.has(ball.id)) {
        this.balls3.set(ball.id, this.add.sprite(
          ball.position.x,
          ball.position.y,
          "bullet"
        ));
      } else {
        const ball2 = this.balls2.get(ball.id);
        if (ball2) {
          this.balls3.get(ball.id)?.setPosition(ball2.x, ball2.y);
        }
      }

      if (!this.balls2.has(ball.id)) {
        this.balls2.set(ball.id, this.add.sprite(
          ball.position.x,
          ball.position.y,
          "bullet"
        ));
      } else {
        const ball1 = this.balls.get(ball.id);
        if (ball1) {
          this.balls2.get(ball.id)?.setPosition(ball1.x, ball1.y);
        }
      }

      if (!this.balls.has(ball.id)) {
        this.balls.set(ball.id, this.add.sprite(
          ball.position.x,
          ball.position.y,
          "bullet"
        ));
      } else {
        this.balls.get(ball.id)?.setPosition(ball.position.x, ball.position.y);
      }

      if (!this.balls2.has(ball.id)) {
        this.balls2.set(ball.id, this.add.sprite(
          ball.position.x,
          ball.position.y,
          "bullet"
        ));
      } else {
        this.balls2.get(ball.id)?.setPosition(ball.position.x, ball.position.y);
      }
    });

    this.balls.forEach((ball, id) => {
      if (!state.balls.some(otherbrick => otherbrick.id === id)) {
        ball.destroy();
        this.balls.delete(id);
      }
    });

    const lambda = 1;

    state.player1.bricks.forEach(brick => {
      if (!this.bricks.has(brick.id)) {
        if (brick.brickType === BrickType.Normal) {
          this.bricks.set(brick.id, this.add.sprite(
            brick.position.x + 16 * brick.scale.x,
            brick.position.y + 4 * brick.scale.y,
            "brick"
          ).setScale(brick.scale.x, brick.scale.y).setTint(brick.color));
        }
      } else {
        const brickSprite = this.bricks.get(brick.id);
        brickSprite?.setX(lambda * (brick.position.x + 16 * brick.scale.x) + (1 - lambda) * brickSprite.x);
        brickSprite?.setY(lambda * (brick.position.y + 4 * brick.scale.y) + (1 - lambda) * brickSprite.y);
      }
    });

    state.player2.bricks.forEach(brick => {
      if (!this.bricks.has(brick.id)) {
        if (brick.brickType === BrickType.Normal) {
          this.bricks.set(brick.id, this.add.sprite(
            brick.position.x + 16 * brick.scale.x,
            brick.position.y + 4 * brick.scale.y,
            "brick"
          ).setScale(brick.scale.x, brick.scale.y).setTint(brick.color));
        }
      } else {
        const brickSprite = this.bricks.get(brick.id);
        brickSprite?.setX(lambda * (brick.position.x + 16 * brick.scale.x) + (1 - lambda) * brickSprite.x);
        brickSprite?.setY(lambda * (brick.position.y + 4 * brick.scale.y) + (1 - lambda) * brickSprite.y);
      }
    });

    this.bricks.forEach((brick, id) => {
      if (!state.player1.bricks.some(otherbrick => otherbrick.id === id)
        && !state.player2.bricks.some(otherbrick => otherbrick.id === id)) {
        brick.destroy();
        this.bricks.delete(id);
      }
    });
  }
}

function lerp(from: GameState, to: GameState, pctElapsed: number): GameState {
  return {
    player1: lerpPlayer(from.player1, to.player1, pctElapsed),
    player2: lerpPlayer(from.player2, to.player2, pctElapsed),

    balls: to.balls
  };
}

function lerpPlayer(from: Player, to: Player, pctElapsed: number): Player {
  const bricks: Brick[] = from.bricks.map(fromBrick => {

    const toBrick = to.bricks.find(otherBrick => otherBrick.id === fromBrick.id);

    if (toBrick) {
      return {
        id: fromBrick.id,
        brickType: fromBrick.brickType,
        position: {
          x: (1 - pctElapsed) * fromBrick.position.x + pctElapsed * toBrick.position.x,
          y: (1 - pctElapsed) * fromBrick.position.y + pctElapsed * toBrick.position.y,
        },
        scale: fromBrick.scale,
        color: fromBrick.color,
      }
    }
    return fromBrick;
  });

  return {
    id: from.id,
    ready: from.ready,
    score: from.score,
    bricks,
  }
}




