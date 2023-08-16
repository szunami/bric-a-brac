import path from "path";
import { fileURLToPath } from "url";

import { UserId, RoomId, Application, startServer, verifyJwt } from "@hathora/server-sdk";
import dotenv from "dotenv";
import { Box, Body, System } from "detect-collisions";
import { BrickType, Direction, GameState, InitialConfig, LobbyState, Momentum } from "../common/types";
import { ClientMessage, ClientMessageType, ServerMessage, ServerMessageType } from "../common/messages";
import map from "../common/map.json" assert { type: "json" };

import { LobbyV2Api, RoomV1Api } from "@hathora/hathora-cloud-sdk";

const lobbyClient = new LobbyV2Api();
const roomClient = new RoomV1Api();

// The millisecond tick rate
const TICK_INTERVAL_MS = 50;

// Player configuration
const PLAYER_RADIUS = 20; // The player's circular radius, used for collision detection
const PLAYER_SPEED = 200; // The player's movement speed
const DASH_DISTANCE = 40; // The player's dash distance

const BALL_SPEED = 100;

// Bullet configuration
const BULLET_RADIUS = 9; // The bullet's circular radius, used for collision detection
const BULLET_SPEED = 1000; // The bullet's movement speed when shot

// Reloading
const BULLETS_MAX = 3;
const RELOAD_SPEED = 3000; // in millis
const DASH_COOLDOWN = 2000; // in millis

// An x, y vector representing the spawn location of the player on the map
const SPAWN_POSITIONS = [
  {
    x: 0,
    y: 0,
  },
];

// The width of the map boundary rectangles
const BOUNDARY_WIDTH = 200;

// An enum which represents the type of body for a given object
enum BodyType {
  Player,
  Ball,
  Brick1,
  Brick2,
}
const PLAYER_SPRITES_COUNT = 9;

// A type to represent a physics body with a type (uses BodyType above)
type PhysicsBody = Body & { oType: BodyType };

// A type which defines the properties of a player used internally on the server (not sent to client)
type InternalPlayer = {
  id: UserId;
  score: number;
  direction: Direction;

  bricks: InternalBrick[];
};

type InternalBall = {
  id: number;
  body: PhysicsBody;
  momentum: Momentum;
}


type InternalBrick = {
  id: number;
  body: PhysicsBody;
  brickType: BrickType;
  color: number;
}

// A type which represents the internal state of the server, containing:
//   - physics: our "physics" engine (detect-collisions library)
//   - players: an array containing all connected players to a room
//   - bullets: an array containing all bullets currently in the air for a given room
//   - winningScore: a number set at creation to determine winner
//   - isGameEnd: a boolean to track if game has ended
type InternalState = {
  physics: System;
  player1: InternalPlayer;
  player2: InternalPlayer;
  balls: InternalBall[];
};

// A map which the server uses to contain all room's InternalState instances
const rooms: Map<RoomId, InternalState> = new Map();

// Create an object to represent our Store
const store: Application = {
  verifyToken(token: string): UserId | undefined {
    const userId = verifyJwt(token, process.env.HATHORA_APP_SECRET!);
    if (userId === undefined) {
      console.error("Failed to verify token", token);
    }
    return userId;
  },

  // subscribeUser is called when a new user enters a room, it's an ideal place to do any player-specific initialization steps
  async subscribeUser(roomId: RoomId, userId: string): Promise<void> {
    console.log("subscribeUser", roomId, userId);
    try {
      const lobbyInfo = await lobbyClient.getLobbyInfo(process.env.HATHORA_APP_ID!, roomId);
      const lobbyState = lobbyInfo.state as LobbyState | undefined;
      const lobbyInitialConfig = lobbyInfo.initialConfig as InitialConfig | undefined;

      if (!rooms.has(roomId)) {
        rooms.set(roomId, initializeRoom());
      }
      const game = rooms.get(roomId)!;

      // Make sure the player hasn't already spawned
      if (game.player1.id === "") {
        game.player1.id = userId;
        await updateLobbyState(game, roomId);
      } else if (game.player2.id === "") {
        game.player2.id = userId;
        await updateLobbyState(game, roomId);
      }
    } catch (err) {
      console.log("failed to connect to room: ", err);
      server.closeConnection(roomId, userId, err instanceof Error ? err.message : "failed to connect to room");
    }
  },

  // unsubscribeUser is called when a user disconnects from a room, and is the place where you'd want to do any player-cleanup
  async unsubscribeUser(roomId: RoomId, userId: string): Promise<void> {
    console.log("unsubscribeUser", roomId, userId);
    // Make sure the room exists
    if (!rooms.has(roomId)) {
      return;
    }

    // Remove the player from the room's state
    const game = rooms.get(roomId)!;

    try {
      await updateLobbyState(game, roomId);
    } catch (err) {
      console.log("failed to connect to room: ", err);
    }
  },

  // onMessage is an integral part of your game's server. It is responsible for reading messages sent from the clients and handling them accordingly, this is where your game's event-based logic should live
  onMessage(roomId: RoomId, userId: string, data: ArrayBuffer): void {
    if (!rooms.has(roomId)) {
      return;
    }

    // Get the player, or return out of the function if they don't exist
    const game = rooms.get(roomId)!;

    var player;

    if (game.player1.id == userId) {
      player = game.player1;
    } else if (game.player2.id == userId) {
      player = game.player2;
    } else {
      return;
    }
    // Parse out the data string being sent from the client
    const message: ClientMessage = JSON.parse(Buffer.from(data).toString("utf8"));
    // Handle the various message types, specific to this game
    if (message.type === ClientMessageType.SetDirection) {
      player.direction = message.direction;
    } else if (message.type === ClientMessageType.Ping) {
      const msg: ServerMessage = {
        type: ServerMessageType.PingResponse,
        id: message.id,
      };
      server.sendMessage(roomId, userId, Buffer.from(JSON.stringify(msg), "utf8"));
    }
  },
};

// Load our environment variables into process.env
dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../.env") });
if (process.env.HATHORA_APP_SECRET === undefined) {
  throw new Error("HATHORA_APP_SECRET not set");
}

// Start the server
const port = parseInt(process.env.PORT ?? "4000");
const server = await startServer(store, port);
console.log(`Server listening on port ${port}`);

// Start the game's update loop
setInterval(() => {
  rooms.forEach((game, roomId) => {
    // Tick each room's game
    tick(roomId, game, TICK_INTERVAL_MS / 1000);

    // Send the state updates to each client connected to that room
    broadcastStateUpdate(roomId);
  });
}, TICK_INTERVAL_MS);

const GRAVITY = 1;

// The frame-by-frame logic of your game should live in it's server's tick function. This is often a place to check for collisions, compute score, and so forth
async function tick(roomId: string, game: InternalState, deltaMs: number) {

  if (game.player1.id === "" || game.player2.id === "") {
    return;
  }

  {
    const SLOWDOWN = game.player1.bricks.length === 0 ? 1 : 1 / game.player1.bricks.length;
    var dx = PLAYER_SPEED * game.player1.direction.x * deltaMs * SLOWDOWN;
    var max = Math.abs(dx);
    var min = -1 * Math.abs(dx);

    game.player1.bricks.forEach(brick => {
      max = Math.min(max, 128 - 32 - brick.body.x);
      min = Math.max(min, -128 - brick.body.x);
    });

    var clampedDx = Math.min(Math.max(min, dx), max);
    game.player1.bricks.forEach(brick => {
      brick.body.x += clampedDx;
    });

    var dy = PLAYER_SPEED * game.player1.direction.y * deltaMs * SLOWDOWN;
    var max = Math.abs(dy);
    var min = -1 * Math.abs(dy);
    game.player1.bricks.forEach(brick => {
      max = Math.min(max, 220 - brick.body.y);
      min = Math.max(min, 0 - brick.body.y);
    });
    var clampedDy = Math.min(Math.max(min, dy), max);
    game.player1.bricks.forEach(brick => {
      brick.body.y += clampedDy;
    });
  }

  {
    const SLOWDOWN = game.player2.bricks.length === 0 ? 1 : 1 / game.player2.bricks.length;

    var dx = PLAYER_SPEED * game.player2.direction.x * deltaMs * SLOWDOWN;
    var max = Math.abs(dx);
    var min = -1 * Math.abs(dx);

    game.player2.bricks.forEach(brick => {
      max = Math.min(max, 128 - 32 - brick.body.x);
      min = Math.max(min, -128 - brick.body.x);
    });

    var clampedDx = Math.min(Math.max(min, dx), max);
    game.player2.bricks.forEach(brick => {
      brick.body.x += clampedDx;
    })
  }

  // Handle collision detections between the various types of PhysicsBody's
  game.physics.checkAll(({ a, b, overlapV }: { a: PhysicsBody; b: PhysicsBody; overlapV: SAT.Vector }) => {
    if (a.oType === BodyType.Player && b.oType === BodyType.Ball) {
      const ballIdx = game.balls.findIndex((ball) => ball.body === b);
      if (ballIdx >= 0) {
        game.balls[ballIdx].momentum = {
          x: game.balls[ballIdx].momentum.x,
          y: -1 * game.balls[ballIdx].momentum.y
        };
        b.setPosition(b.x + overlapV.x, b.y + overlapV.y);
      }
    }

    else if (a.oType === BodyType.Ball && b.oType === BodyType.Brick1) {
      const oldX = b.x;
      const ballIdx: number = game.balls.findIndex((ball) => ball.body === a);
      if (ballIdx >= 0) {
        game.balls[ballIdx].momentum = {
          x: game.balls[ballIdx].momentum.x,
          y: -1 * game.balls[ballIdx].momentum.y
        };
        a.setPosition(a.x - overlapV.x, a.y - overlapV.y);
      }

      const brickIdx = game.player1.bricks.findIndex((brick) => brick.body === b);
      if (brickIdx >= 0) {

        if (game.player1.bricks[brickIdx].brickType === BrickType.Ball) {
          const newBallId = game.balls.length > 0 ? game.balls[game.balls.length - 1].id + 1 : 1;
          const newMomentum = {
            x: -1 * game.balls[ballIdx].momentum.x,
            y: -1 * game.balls[ballIdx].momentum.y
          };
          game.balls.push({
            id: newBallId,
            momentum: newMomentum,
            body: Object.assign(game.physics.createCircle({ x: game.balls[ballIdx].body.x, y: game.balls[ballIdx].body.y }, 8),
              { oType: BodyType.Ball })
          });
        }

        const oldBrickId = game.player1.bricks[brickIdx].id;

        const oldScaleX = b.scaleX;
        const oldScaleY = b.scaleY;

        const oldColor = game.player1.bricks[brickIdx].color;

        game.physics.remove(b);
        game.player1.bricks.splice(brickIdx, 1);

        const newBody = Object.assign(game.physics.createBox({ x: oldX, y: -200 }, 32, 8),
          { oType: BodyType.Brick2 });

        newBody.setScale(oldScaleX, oldScaleY);

        var someoverlap = false;
        game.physics.checkOne(newBody, () => {
          someoverlap = true;
        });

        while (someoverlap) {
          newBody.y += 8;
          someoverlap = false;
          game.physics.checkOne(newBody, () => {
            someoverlap = true;
          });
        }

        game.player2.bricks.push({
          id: oldBrickId,
          brickType: BrickType.Normal,
          body: newBody,
          color: oldColor,
        });
      }
    }

    else if (a.oType === BodyType.Ball && b.oType === BodyType.Brick2) {
      const oldX = b.x;
      const ballIdx: number = game.balls.findIndex((ball) => ball.body === a);
      if (ballIdx >= 0) {
        game.balls[ballIdx].momentum = {
          x: game.balls[ballIdx].momentum.x,
          y: -1 * game.balls[ballIdx].momentum.y
        };
        a.setPosition(a.x - overlapV.x, a.y - overlapV.y);
      }

      const brickIdx = game.player2.bricks.findIndex((brick) => brick.body === b);
      if (brickIdx >= 0) {

        if (game.player2.bricks[brickIdx].brickType === BrickType.Ball) {
          const newBallId = game.balls.length > 0 ? game.balls[game.balls.length - 1].id + 1 : 1;
          const newMomentum = {
            x: -1 * game.balls[ballIdx].momentum.x,
            y: -1 * game.balls[ballIdx].momentum.y
          };
          game.balls.push({
            id: newBallId,
            momentum: newMomentum,
            body: Object.assign(game.physics.createCircle({ x: game.balls[ballIdx].body.x, y: game.balls[ballIdx].body.y }, 8),
              { oType: BodyType.Ball })
          });
        }

        const oldBrickId = game.player2.bricks[brickIdx].id;
        const oldColor = game.player2.bricks[brickIdx].color;

        const oldScaleX = b.scaleX;
        const oldScaleY = b.scaleY;

        game.physics.remove(b);
        game.player2.bricks.splice(brickIdx, 1);

        const newBody = Object.assign(game.physics.createBox({ x: oldX, y: 200 }, 32, 8),
          { oType: BodyType.Brick1 });

        newBody.setScale(oldScaleX, oldScaleY);


        var someoverlap = false;
        game.physics.checkOne(newBody, () => {
          someoverlap = true;
        });

        while (someoverlap) {
          newBody.y -= 8;
          someoverlap = false;
          game.physics.checkOne(newBody, () => {
            someoverlap = true;
          });
        }

        game.player1.bricks.push({
          id: oldBrickId,
          brickType: BrickType.Normal,
          body: newBody,
          color: oldColor,
        });
      }
    }
  });

  game.balls.forEach((ball) => {
    if (ball.body.x > 128) {
      ball.body.x = 128;
      ball.momentum.x *= -1;
    }
    if (ball.body.x < -128) {
      ball.body.x = -128;
      ball.momentum.x *= -1;
    }
    if (ball.body.y > 220) {
      ball.body.y = 220;
      ball.momentum.y *= -1;
    }
    if (ball.body.y < -220) {
      ball.body.y = -220;
      ball.momentum.y *= -1;
    }

    ball.body.x = ball.body.x + ball.momentum.x * deltaMs;
    ball.body.y = ball.body.y + ball.momentum.y * deltaMs;
  });
}

function broadcastStateUpdate(roomId: RoomId) {
  const game = rooms.get(roomId)!;
  const now = Date.now();
  // Map properties in the game's state which the clients need to know about to render the game
  const state: GameState = {
    player1: {
      id: game.player1.id,
      score: game.player1.score,
      bricks: game.player1.bricks.map((brick) => {
        return {
          id: brick.id,
          position: { x: brick.body.x, y: brick.body.y },
          brickType: brick.brickType,
          scale: { x: brick.body.scaleX, y: brick.body.scaleY },
          color: brick.color,
        };
      }),
    },
    player2: {
      id: game.player2.id,
      score: game.player2.score,
      bricks: game.player2.bricks.map((brick) => {
        return {
          id: brick.id,
          position: { x: brick.body.x, y: brick.body.y },
          brickType: brick.brickType,
          scale: { x: brick.body.scaleX, y: brick.body.scaleY },
          color: brick.color,
        };
      }),
    },
    balls: game.balls.map(ball => {
      return { id: ball.id, position: { x: ball.body.x, y: ball.body.y } };
    }),
  };

  // Send the state update to each connected client
  const msg: ServerMessage = {
    type: ServerMessageType.StateUpdate,
    state,
    ts: now,
  };
  server.broadcastMessage(roomId, Buffer.from(JSON.stringify(msg), "utf8"));
}

function makeBox(physics: System,
  x: number, y: number, scaleX: number, scaleY: number, oType: BodyType): PhysicsBody {
  const box = Object.assign(physics.createBox({ x, y }, 32, 8), {
    oType
  });
  box.setScale(scaleX, scaleY);
  return box;
}

const BRICK_TINTS = [0x602c2c, 0x884b2b, 0xbe772b, 0xde9e41];

function randomTint(): number {
  return BRICK_TINTS[Math.floor(Math.random() * BRICK_TINTS.length)];
}

function initializeRoom(): InternalState {
  const physics = new System();
  const tileSize = map.tileSize;

  const player1: InternalPlayer = {
    id: "",
    score: 0,
    direction: { x: 0, y: 0 },

    bricks: [{
      id: 0,
      brickType: BrickType.Normal,
      body: makeBox(physics, 0, 200, 1, 4, BodyType.Brick1),
      color: randomTint(),
    },
    {
      id: 1,
      brickType: BrickType.Normal,
      body: Object.assign(physics.createBox({ x: -32, y: 200 }, 32, 8),
        { oType: BodyType.Brick1 }),
      color: randomTint(),
    },
    {
      id: 2,
      brickType: BrickType.Normal,
      body: Object.assign(physics.createBox({ x: 32, y: 200 }, 32, 8),
        { oType: BodyType.Brick1 }),
      color: randomTint(),

    }
    ],
  };

  const player2: InternalPlayer = {
    id: "",
    score: 0,
    direction: { x: 0, y: 0 },

    bricks: [
      {
        id: 3,
        brickType: BrickType.Normal,
        body: makeBox(physics, 0, -200, 1, 4, BodyType.Brick2),
        color: randomTint(),
      },
      {
        id: 4,
        brickType: BrickType.Normal,
        body: makeBox(physics, 16, -200, 0.5, 1, BodyType.Brick2),
        color: randomTint(),
      },
      {
        id: 5,
        brickType: BrickType.Normal,
        body: Object.assign(physics.createBox({ x: -32, y: -200 }, 32, 8),
          { oType: BodyType.Brick2 }),
        color: randomTint(),
      }
    ],
  };

  return {
    physics,
    player1,
    player2,
    balls: [{
      id: 0,
      body: Object.assign(physics.createCircle({ x: 0, y: 100 }, 8),
        { oType: BodyType.Ball }),
      momentum: {
        x: BALL_SPEED,
        y: -BALL_SPEED
      }
    },
    ],

  };
}

function getDeveloperToken() {
  const token = process.env.DEVELOPER_TOKEN;
  if (token == null) {
    throw new Error("DEVELOPER_TOKEN not set");
  }
  return token;
}

async function endGameCleanup(roomId: string, game: InternalState, winningPlayerId: string) {
  // Update lobby state (to persist end game state and prevent new players from joining)
  await updateLobbyState(game, roomId);

  // boot all players and destroy room
  setTimeout(() => {
    console.log("disconnecting: ", game.player1.id, roomId);
    server.closeConnection(roomId, game.player1.id, "game has ended, disconnecting players");

    console.log("destroying room: ", roomId);
    roomClient.destroyRoom(
      process.env.HATHORA_APP_ID!,
      roomId,
      { headers: { Authorization: `Bearer ${getDeveloperToken()}`, "Content-Type": "application/json" } }
    );
  }, 10000);
}

async function updateLobbyState(game: InternalState, roomId: string) {
  const lobbyState: LobbyState = {
  };
  return await lobbyClient.setLobbyState(process.env.HATHORA_APP_ID!,
    roomId,
    { state: lobbyState },
    { headers: { Authorization: `Bearer ${getDeveloperToken()}`, "Content-Type": "application/json" } }
  );
}
