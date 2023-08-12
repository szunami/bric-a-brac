import ReactDOM from "react-dom/client";
import React, { useEffect, useState } from "react";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { AuthV1Api, LobbyV2Api, RoomV1Api } from "@hathora/hathora-cloud-sdk";
import { HathoraConnection } from "@hathora/client-sdk";

import { SessionMetadata, LobbyState, InitialConfig } from "../../common/types";

import { isReadyForConnect, Token } from "./utils";
import { Socials } from "./components/website/Socials";
import { HathoraLogo } from "./components/website/HathoraLogo";
import { GithubCorner } from "./components/website/GithubCorner";
import { Footer } from "./components/website/Footer";
import { ExplanationText, NavLink } from "./components/website/ExplanationText";
import { Arrow } from "./components/website/Arrow";
import { NicknameScreen } from "./components/lobby/NicknameScreen";
import { LobbySelector } from "./components/lobby/LobbySelector";
import { BulletButton } from "./components/lobby/BulletButton";
import { GameComponent, GameConfig } from "./components/GameComponent";

const authClient = new AuthV1Api();
const lobbyClient = new LobbyV2Api();
const roomClient = new RoomV1Api();

function App() {
  const appId = process.env.HATHORA_APP_ID;
  const token = useAuthToken(appId);
  const [connection, setConnection] = useState<HathoraConnection | undefined>();
  const [sessionMetadata, setSessionMetadata] = useState<SessionMetadata | undefined>(undefined);
  const [failedToConnect, setFailedToConnect] = useState(false);
  const [roomIdNotFound, setRoomIdNotFound] = useState<string | undefined>(undefined);
  const [isNicknameAcked, setIsNicknameAcked] = React.useState<boolean>(false);
  const [roomId, setRoomId] = React.useState<string | undefined>(undefined);

  if (appId == null || token == null) {
    return (
      <div
        className={"bg-neutralgray-700 text-neutralgray-400 text-xl w-full h-screen flex items-center justify-center"}
      >
        Loading...
      </div>
    );
  }
  console.debug(`sessionmetadata: ${sessionMetadata?.roomId}`);
  if (
    roomId != null &&
    sessionMetadata?.roomId != roomId &&
    roomIdNotFound == null &&
    !failedToConnect
  ) {
    // Once we parse roomId from the URL, get connection details to connect player to the server
    isReadyForConnect(appId, roomClient, lobbyClient, roomId)
      .then(async ({ connectionInfo, lobbyInfo }) => {
        console.debug("ready for connect");
        setRoomIdNotFound(undefined);
        if (connection != null) {
          console.debug("connection != null");
          connection.disconnect(1000);
        }

        try {
          const lobbyState = undefined;
          const lobbyInitialConfig = lobbyInfo.initialConfig as InitialConfig | undefined;

          if (!lobbyState) {
            console.debug(`Connecting to room ${roomId}`);
            const connect = new HathoraConnection(roomId, connectionInfo);
            connect.onClose(async () => {
              console.debug("Connection closed");
              // If game has ended, we want updated lobby state
              const updatedLobbyInfo = await lobbyClient.getLobbyInfo(appId, roomId);
              const updatedLobbyState = updatedLobbyInfo.state as LobbyState | undefined;
              const updatedLobbyInitialConfig = updatedLobbyInfo.initialConfig as InitialConfig | undefined;
              setSessionMetadata({
                serverUrl: `${connectionInfo.host}:${connectionInfo.port}`,
                region: updatedLobbyInfo.region,
                roomId: updatedLobbyInfo.roomId,
                creatorId: updatedLobbyInfo.createdBy,
              });
              setFailedToConnect(true);
            });
            console.debug(`Setting connection to ${connect}`);
            setConnection(connect);
          }
          setSessionMetadata({
            serverUrl: `${connectionInfo.host}:${connectionInfo.port}`,
            region: lobbyInfo.region,
            roomId: lobbyInfo.roomId,
            creatorId: lobbyInfo.createdBy,
          });
        } catch (e) {
          console.debug(`Roomid not found`);
          setRoomIdNotFound(roomId);
        }
      })
      .catch(() => {
        console.debug(`Roomid not found`);
        setRoomIdNotFound(roomId);
      });
  }
  return (
    <>
      <div className="py-5 overflow-hidden" style={{ backgroundColor: "#0E0E1B" }}>
        <div className="md:w-fit mx-auto px-2 md:px-0">
          <div className={"md:mt-4 relative"} style={{ width: GameConfig.width, height: GameConfig.height }}>
            {failedToConnect ? (
              <div className="border text-white flex flex-wrap flex-col justify-center h-full w-full content-center text-secondary-400 text-center">
                Connection was closed
                <br />

                <br />
                <a href={"/"} className={"mt-2"}>
                  <BulletButton text={"Return to Lobby"} xlarge />
                </a>
              </div>
            ) : (
              <>
                <div
                  className={
                    "hidden lg:flex items-center gap-2 absolute font-hathora font-bold text-3xl text-neutralgray-550 -left-[220px] top-[272px]"
                  }
                >
                </div>
                <div
                  className={
                    "hidden lg:flex items-center gap-2 absolute font-hathora font-bold text-3xl text-neutralgray-550 -left-[290px] top-[658px]"
                  }
                >
                </div>
                {connection == null && !roomId ? (
                  <LobbySelector
                    appId={appId}
                    playerToken={token}
                    roomIdNotFound={roomIdNotFound}
                    setRoomId={setRoomId}
                  />
                ) : <></>}
                <GameComponent
                  connection={connection}
                  token={token}
                  sessionMetadata={sessionMetadata}
                  isNicknameAcked={isNicknameAcked}
                />
              </>
            )}
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root") as HTMLElement);
root.render(<App />);

// Custom hook to access auth token
function useAuthToken(appId: string | undefined): Token | undefined {
  const [token, setToken] = React.useState<Token | undefined>();
  useEffect(() => {
    if (appId != null) {
      getToken(appId, authClient).then(setToken);
    }
  }, [appId]);
  return token;
}

// 1. Check sessionStorage for existing token
// 2. If googleIdToken passed, use it for auth and store token
// 3. If none above, then use anonymous auth
async function getToken(appId: string, client: AuthV1Api): Promise<Token> {
  const { token } = await client.loginAnonymous(appId);
  return { value: token, type: "anonymous" };
}

function getRoomIdFromUrl(): string | undefined {
  if (location.pathname.length > 1) {
    return location.pathname.split("/").pop();
  }
}
