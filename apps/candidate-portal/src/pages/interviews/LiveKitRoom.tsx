import { LiveKitRoom as Room, RoomAudioRenderer, VideoConference, type LocalUserChoices } from "@livekit/components-react";
import type { JoinTokenDto } from "@verity/shared";

/** The live interview: connects to LiveKit with a server-minted token and the devices chosen in the lobby. */
export function LiveKitRoom({
  conn,
  choices,
  onLeave,
  onError,
}: {
  conn: JoinTokenDto;
  choices: LocalUserChoices;
  onLeave: () => void;
  onError: (e: unknown) => void;
}) {
  return (
    <div data-lk-theme="default" className="h-[min(78vh,760px)] overflow-hidden rounded-3xl">
      <Room
        serverUrl={conn.url}
        token={conn.token}
        connect
        video={choices.videoEnabled ? { deviceId: choices.videoDeviceId } : false}
        audio={choices.audioEnabled ? { deviceId: choices.audioDeviceId } : false}
        onDisconnected={onLeave}
        onError={onError}
        className="h-full"
      >
        <VideoConference />
        <RoomAudioRenderer />
      </Room>
    </div>
  );
}
