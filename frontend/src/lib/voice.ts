import { API_URL } from "./config";

/** One push-to-talk utterance, streamed to the backend's speech-to-text proxy
 * (`/v1/voice/transcribe`, Meta's realtime ASR behind it). The agent itself
 * has no voice: the transcript lands in the composer for the farmer to send. */
export type Dictation = {
  /** Button released: stop the mic and wait for the final transcript. */
  stop: () => void;
  /** Throw the utterance away. */
  cancel: () => void;
};

export type DictationError = "unsupported" | "denied" | "failed";

type Handlers = {
  /** Cumulative transcript so far; replaces the previous one. */
  onText: (text: string) => void;
  /** Called once: the final text (may be empty), or an error. */
  onDone: (result: { text: string } | { error: DictationError }) => void;
};

export function canDictate(): boolean {
  // getUserMedia exists only in secure contexts (https or localhost).
  return typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia && typeof AudioWorkletNode !== "undefined";
}

export function startDictation(phone: string, { onText, onDone }: Handlers): Dictation {
  let finished = false;
  let ready = false;
  let ending = false;
  let text = "";
  const pending: ArrayBuffer[] = [];
  let mic: MediaStream | null = null;
  let ctx: AudioContext | null = null;

  const ws = new WebSocket(`${API_URL.replace(/^http/, "ws")}/v1/voice/transcribe?phone=${encodeURIComponent(phone)}`);
  ws.binaryType = "arraybuffer";

  const releaseMic = () => {
    mic?.getTracks().forEach((t) => t.stop());
    void ctx?.close().catch(() => {});
    mic = null;
    ctx = null;
  };
  const finish = (result: { text: string } | { error: DictationError }) => {
    if (finished) return;
    finished = true;
    releaseMic();
    if (ws.readyState <= WebSocket.OPEN) ws.close();
    onDone(result);
  };
  const sendEnd = () => {
    pending.splice(0).forEach((b) => ws.send(b));
    ws.send(JSON.stringify({ type: "endStream" }));
  };

  ws.onmessage = (e) => {
    if (typeof e.data !== "string") return;
    const msg = JSON.parse(e.data);
    if (msg.type === "ready") {
      ready = true;
      if (ending) sendEnd();
      else pending.splice(0).forEach((b) => ws.send(b));
    } else if (msg.type === "transcript") {
      text = msg.transcript;
      if (msg.final) finish({ text });
      else onText(text);
    } else if (msg.type === "error") {
      finish({ error: "failed" });
    }
  };
  ws.onerror = () => finish({ error: "failed" });
  ws.onclose = () => finish(ending ? { text } : { error: "failed" });

  (async () => {
    try {
      mic = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
    } catch (err) {
      finish({ error: err instanceof DOMException && err.name === "NotAllowedError" ? "denied" : "unsupported" });
      return;
    }
    if (finished) return releaseMic(); // released before the permission prompt was answered
    ctx = new AudioContext();
    await ctx.audioWorklet.addModule("/pcm-worklet.js");
    if (finished || !ctx) return;
    const node = new AudioWorkletNode(ctx, "pcm-worklet", { numberOfInputs: 1, numberOfOutputs: 0 });
    node.port.onmessage = (e: MessageEvent<ArrayBuffer>) => {
      if (ending) return;
      if (ready && ws.readyState === WebSocket.OPEN) ws.send(e.data);
      else pending.push(e.data);
    };
    ctx.createMediaStreamSource(mic).connect(node);
  })().catch(() => finish({ error: "failed" }));

  return {
    stop: () => {
      if (ending || finished) return;
      ending = true;
      releaseMic();
      if (ready && ws.readyState === WebSocket.OPEN) sendEnd();
    },
    cancel: () => {
      if (finished) return;
      finished = true;
      releaseMic();
      ws.close();
    },
  };
}
