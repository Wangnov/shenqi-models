const scores = [
  { file: 'eternity', title: '永恒 · 不灭之环' },
  { file: 'space', title: '空间 · 折叠之门' },
  { file: 'time', title: '时间 · 逆流春秋' },
];

type Voice = { source: AudioBufferSourceNode; gain: GainNode };

/** User-activated, locally hosted scores with click-free chapter transitions. */
export class SceneMusic {
  enabled = false;
  current = 0;
  private context?: AudioContext;
  private master?: GainNode;
  private buffers = new Map<number, Promise<AudioBuffer>>();
  private voices = new Map<number, Voice>();
  private revision = 0;
  private suspendTimer?: ReturnType<typeof setTimeout>;

  get title() { return scores[this.current].title; }
  get state() {
    return { enabled: this.enabled, scene: this.current, title: this.title,
      context: this.context?.state ?? 'uninitialized', loaded: this.voices.size };
  }

  private async buffer(index: number) {
    const cached = this.buffers.get(index);
    if (cached) return cached;
    const pending = (async () => {
      const response = await fetch(`${import.meta.env.BASE_URL}audio/${scores[index].file}.mp3`);
      if (!response.ok) throw new Error(`配乐加载失败 (${response.status})`);
      const decoded = await this.context!.decodeAudioData(await response.arrayBuffer());
      // Blend the original tail into its beginning once, then loop the result.
      // Linear crossfade avoids a gain bump when the two sections are correlated.
      const overlap = Math.min(Math.round(decoded.sampleRate * 2), Math.floor(decoded.length / 8));
      const length = decoded.length - overlap;
      const loop = this.context!.createBuffer(decoded.numberOfChannels, length, decoded.sampleRate);
      for (let channel = 0; channel < decoded.numberOfChannels; channel++) {
        const input = decoded.getChannelData(channel), output = loop.getChannelData(channel);
        output.set(input.subarray(overlap, length));
        for (let sample = 0; sample < overlap; sample++) {
          const mix = sample / (overlap - 1);
          output[length - overlap + sample] = input[length + sample] * (1 - mix) + input[sample] * mix;
        }
      }
      return loop;
    })();
    this.buffers.set(index, pending);
    try { return await pending; }
    catch (error) { this.buffers.delete(index); throw error; }
  }

  async setEnabled(enabled: boolean, index = this.current) {
    this.enabled = enabled;
    clearTimeout(this.suspendTimer);
    if (!enabled) {
      this.revision++;
      if (this.master && this.context) {
        this.master.gain.setTargetAtTime(0, this.context.currentTime, .18);
        this.suspendTimer = setTimeout(() => {
          if (!this.enabled) void this.context?.suspend();
        }, 1200);
      }
      return;
    }
    if (!this.context) {
      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.master.gain.value = 0;
      this.master.connect(this.context.destination);
    }
    await this.context.resume();
    await this.select(index);
  }

  async select(index: number) {
    this.current = index;
    const revision = ++this.revision;
    if (!this.enabled || !this.context) return;
    const buffer = await this.buffer(index);
    if (revision !== this.revision || !this.enabled) return;
    let voice = this.voices.get(index);
    if (!voice) {
      const gain = this.context.createGain();
      gain.gain.value = 0;
      gain.connect(this.master!);
      const source = this.context.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      source.connect(gain);
      source.start();
      voice = { source, gain };
      this.voices.set(index, voice);
    }
    const now = this.context.currentTime;
    this.master!.gain.setTargetAtTime(.75, now, .4);
    this.voices.forEach((value, key) => value.gain.gain.setTargetAtTime(key === index ? 1 : 0, now, .45));
  }

  async setHidden(hidden: boolean) {
    if (!this.context) return;
    if (hidden) await this.context.suspend();
    else if (this.enabled) await this.context.resume();
  }
}
