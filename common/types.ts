import { Region } from "@hathora/hathora-cloud-sdk";

export type Direction = {
  x: number;
}

export type Momentum = {
  x: number;
  y: number;
}

export type Position = {
  x: number;
  y: number;
};

export type Player = {
  id: string;
  position: Position;
};

export type Brick = {
  id: number;
  position: Position;
}

export type Ball = {
  id: number;
  position: Position;
}

export type GameState = {
  player: Player;
  balls: Ball[];
  bricks: Brick[];
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
