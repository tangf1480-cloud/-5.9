class AudioSystem {
  context: AudioContext | null = null;
  masterGain: GainNode | null = null;
  boostOsc: OscillatorNode | null = null;
  boostGain: GainNode | null = null;
  isInitialized: boolean = false;
  
  bgmGain: GainNode | null = null;
  bgmOsc: OscillatorNode | null = null;
  bgmOsc2: OscillatorNode | null = null;
  bgmFilter: BiquadFilterNode | null = null;

  init() {
    if (this.isInitialized) return;
    try {
      this.context = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.masterGain = this.context.createGain();
      this.masterGain.connect(this.context.destination);
      this.setVolume(0.5);
      this.isInitialized = true;
    } catch (e) {
      console.warn("Web Audio API not supported", e);
    }
  }

  setVolume(volume: number) {
    if (this.masterGain) {
      this.masterGain.gain.value = volume;
    }
  }

  resume() {
    if (this.context && this.context.state === 'suspended') {
      this.context.resume();
    }
  }

  playCollect() {
    if (!this.context || !this.masterGain) return;
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, this.context.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1760, this.context.currentTime + 0.1);

    gain.gain.setValueAtTime(0.3, this.context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.context.currentTime + 0.1);

    osc.start(this.context.currentTime);
    osc.stop(this.context.currentTime + 0.1);
  }

  playDeath() {
    if (!this.context || !this.masterGain) return;
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, this.context.currentTime);
    osc.frequency.exponentialRampToValueAtTime(40, this.context.currentTime + 0.5);

    gain.gain.setValueAtTime(0.5, this.context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.context.currentTime + 0.5);

    osc.start(this.context.currentTime);
    osc.stop(this.context.currentTime + 0.5);
  }

  startBoost() {
    if (!this.context || !this.masterGain) return;
    if (this.boostOsc) return;

    this.boostOsc = this.context.createOscillator();
    this.boostGain = this.context.createGain();
    this.boostOsc.connect(this.boostGain);
    this.boostGain.connect(this.masterGain);

    this.boostOsc.type = 'triangle';
    this.boostOsc.frequency.setValueAtTime(100, this.context.currentTime);
    this.boostOsc.frequency.linearRampToValueAtTime(200, this.context.currentTime + 0.2);

    this.boostGain.gain.setValueAtTime(0, this.context.currentTime);
    this.boostGain.gain.linearRampToValueAtTime(0.1, this.context.currentTime + 0.2);

    this.boostOsc.start();
  }

  stopBoost() {
    if (!this.context || !this.boostOsc || !this.boostGain) return;
    
    this.boostGain.gain.cancelScheduledValues(this.context.currentTime);
    this.boostGain.gain.setValueAtTime(this.boostGain.gain.value, this.context.currentTime);
    this.boostGain.gain.exponentialRampToValueAtTime(0.01, this.context.currentTime + 0.1);
    
    this.boostOsc.stop(this.context.currentTime + 0.1);
    this.boostOsc = null;
    this.boostGain = null;
  }

  startBGM() {
    if (!this.context || !this.masterGain) return;
    if (this.bgmOsc) return;

    this.bgmGain = this.context.createGain();
    this.bgmGain.gain.value = 0.05; // gentle volume
    this.bgmGain.connect(this.masterGain);

    this.bgmFilter = this.context.createBiquadFilter();
    this.bgmFilter.type = 'lowpass';
    this.bgmFilter.frequency.value = 400;
    
    // Add some LFO to the filter
    const lfo = this.context.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 0.5; // slow sweep
    const lfoGain = this.context.createGain();
    lfoGain.gain.value = 200;
    lfo.connect(lfoGain);
    lfoGain.connect(this.bgmFilter.frequency);
    lfo.start();

    this.bgmFilter.connect(this.bgmGain);

    this.bgmOsc = this.context.createOscillator();
    this.bgmOsc.type = 'square';
    this.bgmOsc.frequency.value = 55; // low A
    this.bgmOsc.connect(this.bgmFilter);

    this.bgmOsc2 = this.context.createOscillator();
    this.bgmOsc2.type = 'sawtooth';
    this.bgmOsc2.frequency.value = 110; // an octave higher
    this.bgmOsc2.connect(this.bgmFilter);

    this.bgmOsc.start();
    this.bgmOsc2.start();
  }

  stopBGM() {
    if (this.bgmOsc) {
      try { this.bgmOsc.stop(); } catch(e){}
      this.bgmOsc.disconnect();
      this.bgmOsc = null;
    }
    if (this.bgmOsc2) {
      try { this.bgmOsc2.stop(); } catch(e){}
      this.bgmOsc2.disconnect();
      this.bgmOsc2 = null;
    }
    if (this.bgmGain) {
      this.bgmGain.disconnect();
      this.bgmGain = null;
    }
    if (this.bgmFilter) {
      this.bgmFilter.disconnect();
      this.bgmFilter = null;
    }
  }
}

export const audio = new AudioSystem();
