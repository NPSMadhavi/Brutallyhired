import type { ProctoringEventType } from "@verity/shared";
import { useCallback, useEffect, useRef, useState } from "react";
import { sendProctoringEvents, uploadRecordingChunk } from "@/api/hooks";

type Ev = { type: ProctoringEventType; at: string; detail?: Record<string, string | number | boolean> };
type Kind = "camera" | "screen";
export type CheckState = "pending" | "ok" | "fail";

const CHUNK_MS = 10_000;
const FLUSH_MS = 5_000;

const pickMime = () =>
  ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"].find((m) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(m)) ?? "";

export const proctoringSupported = () =>
  typeof navigator !== "undefined" &&
  !!navigator.mediaDevices?.getUserMedia &&
  !!navigator.mediaDevices?.getDisplayMedia &&
  typeof MediaRecorder !== "undefined";

/**
 * Browser-side proctoring: camera + screen capture (WebRTC media + Screen Capture API), recorded in chunks
 * with MediaRecorder and uploaded in order, plus focus/visibility/fullscreen signals. Everything goes to
 * the hiring team for human review; nothing here decides an outcome.
 */
export function useProctoring(slug: string) {
  const [camera, setCamera] = useState<MediaStream | null>(null);
  const [checks, setChecks] = useState<{ camera: CheckState; screen: CheckState }>({ camera: "pending", screen: "pending" });
  const [screenWarning, setScreenWarning] = useState(false);
  const streams = useRef<{ camera?: MediaStream; screen?: MediaStream }>({});
  const recorders = useRef<MediaRecorder[]>([]);
  const attemptId = useRef<string | null>(null);
  const queue = useRef<Ev[]>([]);
  const uploads = useRef<Promise<unknown>>(Promise.resolve());
  const seq = useRef<Record<Kind, number>>({ camera: 0, screen: 0 });

  const log = useCallback((type: ProctoringEventType, detail?: Ev["detail"]) => {
    queue.current.push({ type, at: new Date().toISOString(), detail });
  }, []);

  const flush = useCallback(async () => {
    if (!attemptId.current || queue.current.length === 0) return;
    const batch = queue.current.splice(0, 200);
    await sendProctoringEvents(slug, attemptId.current, batch).catch(() => queue.current.unshift(...batch));
  }, [slug]);

  /** Ask for camera, microphone and full-screen sharing. Used by the pre-check and again before starting. */
  const acquire = useCallback(async () => {
    try {
      const cam = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 360 }, audio: true });
      streams.current.camera = cam;
      setCamera(cam);
      setChecks((c) => ({ ...c, camera: "ok" }));
    } catch {
      setChecks((c) => ({ ...c, camera: "fail" }));
      log("camera_denied");
      return false;
    }
    try {
      const scr = await navigator.mediaDevices.getDisplayMedia({ video: { displaySurface: "monitor" } as MediaTrackConstraints, audio: false });
      streams.current.screen = scr;
      const surface = scr.getVideoTracks()[0]?.getSettings().displaySurface;
      const whole = !surface || surface === "monitor";
      setScreenWarning(!whole);
      if (!whole) log("screen_not_monitor", { surface: String(surface) });
      setChecks((c) => ({ ...c, screen: whole ? "ok" : "fail" }));
      return whole;
    } catch {
      setChecks((c) => ({ ...c, screen: "fail" }));
      log("screen_denied");
      return false;
    }
  }, [log]);

  const record = useCallback(
    (kind: Kind, stream: MediaStream) => {
      const mimeType = pickMime();
      const rec = new MediaRecorder(stream, mimeType ? { mimeType, videoBitsPerSecond: kind === "screen" ? 600_000 : 350_000 } : undefined);
      rec.ondataavailable = (e) => {
        if (!e.data.size || !attemptId.current) return;
        const n = seq.current[kind]++;
        const id = attemptId.current;
        uploads.current = uploads.current.then(() => uploadRecordingChunk(slug, id, kind, n, e.data).catch(() => undefined));
      };
      stream.getVideoTracks()[0]?.addEventListener("ended", () => log(kind === "camera" ? "camera_ended" : "screen_ended"));
      rec.start(CHUNK_MS);
      recorders.current.push(rec);
    },
    [log, slug],
  );

  const start = useCallback(
    (id: string) => {
      attemptId.current = id;
      log("session_started", { screens: (window.screen as Screen & { isExtended?: boolean }).isExtended ? 2 : 1 });
      if ((window.screen as Screen & { isExtended?: boolean }).isExtended) log("multiple_displays");
      if (streams.current.camera) record("camera", streams.current.camera);
      if (streams.current.screen) record("screen", streams.current.screen);
    },
    [log, record],
  );

  const stop = useCallback(async () => {
    log("session_submitted");
    recorders.current.forEach((r) => r.state !== "inactive" && r.stop());
    recorders.current = [];
    Object.values(streams.current).forEach((s) => s?.getTracks().forEach((tr) => tr.stop()));
    streams.current = {};
    setCamera(null);
    await uploads.current;
    await flush();
  }, [flush, log]);

  // Focus, visibility, fullscreen, clipboard and network signals while an attempt is running.
  useEffect(() => {
    const on = <K extends keyof WindowEventMap>(t: K, fn: () => void) => {
      window.addEventListener(t, fn);
      return () => window.removeEventListener(t, fn);
    };
    const offs = [
      on("blur", () => attemptId.current && log("window_blur")),
      on("focus", () => attemptId.current && log("window_focus")),
      on("copy", () => attemptId.current && log("copy")),
      on("paste", () => attemptId.current && log("paste")),
      on("offline", () => attemptId.current && log("network_offline")),
      on("online", () => attemptId.current && log("network_online")),
    ];
    const vis = () => attemptId.current && log(document.hidden ? "tab_hidden" : "tab_visible");
    const fs = () => attemptId.current && log(document.fullscreenElement ? "fullscreen_enter" : "fullscreen_exit");
    document.addEventListener("visibilitychange", vis);
    document.addEventListener("fullscreenchange", fs);
    const timer = window.setInterval(() => void flush(), FLUSH_MS);
    return () => {
      offs.forEach((f) => f());
      document.removeEventListener("visibilitychange", vis);
      document.removeEventListener("fullscreenchange", fs);
      window.clearInterval(timer);
    };
  }, [flush, log]);

  useEffect(
    () => () => {
      recorders.current.forEach((r) => r.state !== "inactive" && r.stop());
      Object.values(streams.current).forEach((s) => s?.getTracks().forEach((tr) => tr.stop()));
    },
    [],
  );

  return { camera, checks, screenWarning, acquire, start, stop };
}
