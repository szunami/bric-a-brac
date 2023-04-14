import React from "react";

import { InitialConfig, LobbyState } from "../../../common/types";
import { PlayerLobbyClient } from "../../../common/lobby-service/PlayerLobbyClient";

import { PublicLobbyList } from "./PublicLobbyList";
import { LobbyPageCard } from "./LobbyPageCard";
import { GameCreator } from "./GameCreator";
interface LobbySelectorProps {
  lobbyClient: PlayerLobbyClient<LobbyState, InitialConfig>;
  joinRoom: (roomId: string) => void;
  playerToken: string;
}

export function LobbySelector(props: LobbySelectorProps) {
  const { lobbyClient, joinRoom, playerToken } = props;
  const [privateLobbyID, setPrivateLobbyID] = React.useState<string>("");
  return (
    <div className="bg-[url('/splash.png')] h-full flex flex-col p-1">
      <div className={"flex items-center justify-center mt-6 mb-4"}>
        <img src="lobby_header.png" alt="logo" className="" />
      </div>
      <div className="flex overflow-hidden h-full w-full justify-between">
        <div className="grow">
          <PublicLobbyList lobbyClient={lobbyClient} joinRoom={joinRoom} />
        </div>
        <div className="flex flex-col grow">
          <GameCreator lobbyClient={lobbyClient} playerToken={playerToken} joinRoom={joinRoom} />
          <LobbyPageCard>
            Join existing game
            <input
              name="gameCode"
              placeholder="ENTER ROOM CODE"
              value={privateLobbyID}
              onChange={(e) => setPrivateLobbyID(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  joinRoom(privateLobbyID);
                }
              }}
            />
          </LobbyPageCard>
        </div>
      </div>
    </div>
  );
}
