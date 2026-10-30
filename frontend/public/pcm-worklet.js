// Mic → 16-bit PCM at 24 kHz for Meta's realtime ASR (see lib/voice.ts).
// Resamples here rather than with AudioContext({ sampleRate }) because Firefox
// refuses to connect a mic stream to a context at a different rate.
const TARGET_RATE = 24000;
const CHUNK = 1920; // 80 ms

class PcmWorklet extends AudioWorkletProcessor {
  constructor() {
    super();
    this.step = sampleRate / TARGET_RATE; // input samples per output sample
    this.pos = 0; // read position into the current input block, carried across blocks
    this.last = 0; // final sample of the previous block, for interpolating across the seam
    this.out = new Int16Array(CHUNK);
    this.n = 0;
  }

  process(inputs) {
    const input = inputs[0]?.[0];
    if (!input) return true;
    for (; this.pos < input.length; this.pos += this.step) {
      const i = Math.floor(this.pos);
      const frac = this.pos - i;
      const a = i === 0 ? this.last : input[i - 1];
      const s = a + (input[i] - a) * frac;
      this.out[this.n++] = Math.max(-1, Math.min(1, s)) * 0x7fff;
      if (this.n === CHUNK) {
        this.port.postMessage(this.out.buffer, [this.out.buffer]);
        this.out = new Int16Array(CHUNK);
        this.n = 0;
      }
    }
    this.pos -= input.length;
    this.last = input[input.length - 1];
    return true;
  }
}

registerProcessor("pcm-worklet", PcmWorklet);
