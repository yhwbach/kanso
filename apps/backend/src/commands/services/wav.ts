export function wavToMono16k(buf: Buffer): Float32Array {
  if (buf.length < 44 || buf.toString("ascii", 0, 4) !== "RIFF" || buf.toString("ascii", 8, 12) !== "WAVE") {
    throw new Error("Expected a RIFF/WAVE audio file");
  }
  let offset = 12;
  let channels = 1;
  let sampleRate = 16000;
  let bits = 16;
  let format = 1;
  let data: Buffer | null = null;
  while (offset + 8 <= buf.length) {
    const id = buf.toString("ascii", offset, offset + 4);
    const size = buf.readUInt32LE(offset + 4);
    const body = offset + 8;
    if (id === "fmt ") {
      format = buf.readUInt16LE(body);
      channels = buf.readUInt16LE(body + 2);
      sampleRate = buf.readUInt32LE(body + 4);
      bits = buf.readUInt16LE(body + 14);
    } else if (id === "data") {
      data = buf.subarray(body, Math.min(buf.length, body + size));
      break;
    }
    offset = body + size + (size % 2);
  }
  if (!data) throw new Error("WAV file has no data chunk");

  const bytes = bits / 8;
  const frames = Math.floor(data.length / (channels * bytes));
  const mono = new Float32Array(frames);
  for (let i = 0; i < frames; i++) {
    let sum = 0;
    for (let c = 0; c < channels; c++) {
      const idx = (i * channels + c) * bytes;
      if (format === 3 && bits === 32) sum += data.readFloatLE(idx);
      else if (bits === 16) sum += data.readInt16LE(idx) / 32768;
      else if (bits === 32) sum += data.readInt32LE(idx) / 2147483648;
      else if (bits === 8) sum += (data.readUInt8(idx) - 128) / 128;
    }
    mono[i] = sum / channels;
  }
  if (sampleRate === 16000) return mono;
  const ratio = sampleRate / 16000;
  const out = new Float32Array(Math.floor(mono.length / ratio));
  for (let i = 0; i < out.length; i++) {
    const pos = i * ratio;
    const i0 = Math.floor(pos);
    const i1 = Math.min(mono.length - 1, i0 + 1);
    out[i] = mono[i0] + (mono[i1] - mono[i0]) * (pos - i0);
  }
  return out;
}
