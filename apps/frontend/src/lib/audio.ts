export interface Recording {
  stop(): Promise<Blob>;
  cancel(): void;
  stream: MediaStream;
}

export async function startRecording(): Promise<Recording> {
  if (!window.isSecureContext || !navigator.mediaDevices)
    throw new Error("Your browser only allows the microphone on a secure page. Open Kanso with https, or at localhost on this computer.");
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
  const recorder = new MediaRecorder(stream);
  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  recorder.start();
  const release = () => stream.getTracks().forEach((t) => t.stop());
  return {
    stream,
    cancel() {
      recorder.stop();
      release();
    },
    stop() {
      return new Promise<Blob>((resolve, reject) => {
        recorder.onstop = async () => {
          release();
          try {
            resolve(await toWav16k(new Blob(chunks, { type: recorder.mimeType })));
          } catch (err) {
            reject(err);
          }
        };
        recorder.stop();
      });
    },
  };
}

async function toWav16k(blob: Blob): Promise<Blob> {
  const ctx = new AudioContext();
  const decoded = await ctx.decodeAudioData(await blob.arrayBuffer());
  await ctx.close();
  const length = Math.ceil(decoded.duration * 16000);
  const offline = new OfflineAudioContext(1, length, 16000);
  const src = offline.createBufferSource();
  src.buffer = decoded;
  src.connect(offline.destination);
  src.start();
  const rendered = await offline.startRendering();
  return encodeWav(rendered.getChannelData(0), 16000);
}

function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const write = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  };
  write(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  write(8, "WAVE");
  write(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  write(36, "data");
  view.setUint32(40, samples.length * 2, true);
  let offset = 44;
  for (const s of samples) {
    const v = Math.max(-1, Math.min(1, s));
    view.setInt16(offset, v < 0 ? v * 0x8000 : v * 0x7fff, true);
    offset += 2;
  }
  return new Blob([buffer], { type: "audio/wav" });
}
