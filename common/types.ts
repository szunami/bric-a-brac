import { Region } from "@hathora/hathora-cloud-sdk";

export type Direction = {
  x: number;
};

export type Position = {
  x: number;
  y: number;
};

export type Player = {
  id: string;
  position: Position;
  sprite: number;
};

export type Bullet = {
  id: number;
  position: Position;
};

export type GameState = {
  player: Player;
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
  capacity: number;
  winningScore: number;
  isGameEnd: boolean;
  winningPlayerId?: string;
  playerNicknameMap: { [playerId: string]: string };
  creatorId: string;
};
