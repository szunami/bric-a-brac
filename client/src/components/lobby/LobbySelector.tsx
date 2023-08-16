import React from "react";

import { Token } from "../../utils";

import { PublicLobbyList } from "./PublicLobbyList";
import { LobbyPageCard } from "./LobbyPageCard";
import { Header } from "./Header";
import { GameCreator } from "./GameCreator";

interface LobbySelectorProps {
  appId: string;
  playerToken: Token;
  roomIdNotFound: string | undefined;
  setRoomId: (roomId: string) => void;
}
export function LobbySelector(props: LobbySelectorProps) {
  const { appId, playerToken, roomIdNotFound, setRoomId } = props;
  const [privateLobbyID, setPrivateLobbyID] = React.useState<string>("");
  return (
    <div className="h-full flex flex-col p-1 relative">
      {roomIdNotFound && (
        <div className={"absolute left-1/2 -translate-x-1/2 font-semibold"}>
          Room not found: {roomIdNotFound}
        </div>
      )}
      <div className={"flex items-center justify-center mt-6 mb-4"}>
      </div>
      <div className="flex overflow-hidden h-full w-full justify-between">
        <div className="grow">
          <PublicLobbyList appId={appId} setRoomId={setRoomId} />
        </div>
        <div className="flex flex-col grow w-[240px]">
          <GameCreator appId={appId} playerToken={playerToken} setRoomId={setRoomId} />
          <LobbyPageCard>
            <Header className="mt-3 mb-1">Join Game</Header>
            <input
              className="px-4 py-2 bg-secondary-600 rounded placeholder:text-secondary-800 text-secondary-800 cursor-text mb-3"
              name="gameCode"
              placeholder="ENTER ROOM CODE"
              value={privateLobbyID}
              onChange={(e) => setPrivateLobbyID(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  setRoomId(privateLobbyID);
                }
              }}
            />
          </LobbyPageCard>
        </div>
      </div>
    </div>
  );
}
