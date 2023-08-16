import { Region } from "@hathora/hathora-cloud-sdk";

export type Direction = {
  x: number;
  y: number;
}

export type Momentum = {
  x: number;
  y: number;
}

export type XY = {
  x: number;
  y: number;
};

export type Player = {
  id: string;
  score: number;

  bricks: Brick[];
};

export enum BrickType {
  Normal,
  Ball
}


export type Brick = {
  id: number;
  position: XY;
  scale: XY;
  brickType: BrickType;
  color: number;
}

export type Ball = {
  id: number;
  position: XY;
}

export type GameState = {
  player1: Player;
  player2: Player;
  balls: Ball[];
};

export type LobbyState = {
};

export type InitialConfig = {
  capacity: number;
  winningScore: number;
};

export type SessionMetadata = {
  serverUrl: string;
  roomId: string;
  region: Region;
  creatorId: string;
};
