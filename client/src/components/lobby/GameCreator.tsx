import React from "react";
import { GoogleLogin } from "@react-oauth/google";
import { LobbyV2Api, RoomV1Api, Region } from "@hathora/hathora-cloud-sdk";

import { isReadyForConnect, Token } from "../../utils";
import { InitialConfig } from "../../../../common/types";

import { MultiSelect } from "./MultiSelect";
import { LobbyPageCard } from "./LobbyPageCard";
import { Header } from "./Header";
import { Dropdown } from "./Dropdown";
import { BulletButton } from "./BulletButton";

const lobbyClient = new LobbyV2Api();
const roomClient = new RoomV1Api();

interface GameCreatorProps {
  appId: string;
  playerToken: Token;
}
export function GameCreator(props: GameCreatorProps) {
  const { appId, playerToken } = props;
  const [visibility, setVisibility] = React.useState<"public" | "private" | "local">("public");
  const [region, setRegion] = React.useState<Region>(Region.Chicago);
  const [capacity, setCapacity] = React.useState<number>(6);
  const [winningScore, setWinningScore] = React.useState<number>(5);
  const [isLoading, setIsLoading] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string>("");

  const initialConfig: InitialConfig = { capacity, winningScore };
  return (
    <LobbyPageCard className={"pb-1.5"}>
      <Header className="mt-4 mb-2">Create Game</Header>
      <MultiSelect
        className="mb-2"
        options={import.meta.env.DEV ? ["public", "private", "local"] : ["public", "private"]}
        selected={visibility}
        onSelect={setVisibility}
      />
      <Dropdown className="mb-2" width="w-56" options={Object.values(Region)} selected={region} onSelect={setRegion} />
      <div className={"flex flex-col items-center"}>
        <div className={"relative"}>
          <button
            onClick={async () => {
              if (!isLoading) {
                setError("");
                setIsLoading(true);
                try {
                  const lobby = await lobbyClient.createLobby(appId, playerToken.value, {
                    visibility,
                    region,
                    initialConfig,
                  });
                  // Wait until lobby connection details are ready before redirect player to match
                  await isReadyForConnect(appId, roomClient, lobbyClient, lobby.roomId);
                  window.location.href = `/${lobby.roomId}`; //update url
                } catch (e) {
                  setError(e instanceof Error ? e.toString() : typeof e === "string" ? e : "Unknown error");
                } finally {
                  setIsLoading(false);
                }
              }
            }}
          >
            <BulletButton text={"CREATE!"} disabled={isLoading} large />
          </button>
          {isLoading && (
            <div className={"absolute left-[6.6rem] top-[0.28rem] text-brand-500 loading-dots-animation"}>
              Starting...
            </div>
          )}
        </div>
      </div>
      {error && <div className={"-mt-1 text-brand-500 text-xs"}>{error}</div>}
    </LobbyPageCard>
  );
}
