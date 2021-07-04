import Sound, { Frames } from './sound'
import Evt from './evt'

export interface TransportParams {
  sounds?: Sound[]
  audioCtx?: AudioContext
}

export interface ITransport {
  setPlayState: (state: string) => void
  play: () => void
  pause: () => void
  playPause: () => void
  stop: () => void
  setPlayhead: (ms: number) => void
  getPlayState: () => string
}

class Transport extends Evt implements ITransport {
  audioCtx: AudioContext
  sounds: Sound[]
  playState = 'stopped'
  playhead = 0 /* playhead position in ms */
  playheadBase = 0
  destination?: AudioNode
  startTime = 0 /* current time when audioCtx started playing, used to offset the playhead */
  audioNodeMap = new Map<Sound, { 
    gain: GainNode,
    pan: StereoPannerNode
  }>()
  activeSources = new Map<AudioBufferSourceNode, GainNode>()
  /* a set of exclusions to NOT play EVER, by sound UID */
  exclusions = new Set<string>()
  loopLength = -1
  loopTimerId = -1
  loopStart = 0
  /* map an offset value to a transport to sync with */
  syncs = new Map<Transport, number>()

  constructor({ sounds = [], audioCtx }: TransportParams) {
    super()
    this.sounds = sounds

    if (!audioCtx) {
      this.audioCtx = new AudioContext()
    } else {
      this.audioCtx = audioCtx
    }

    this.audioCtx.addEventListener('statechange', () => {
      this.fire('play-state', { playState: this.audioCtx.state })
    })

  }

  setSoundName({ sound, name }: { sound: Sound, name: string }) {
    sound.name = name
    this.fire('set-sound-name', { sound, name })
    sound.fire('set-sound-name', { sound, name })
  }

  setSoundStops({ sound, stops }: { sound: Sound, stops: number[] }) {
    if (this.mapPlayState() !== 'stopped') {
      this.stop()
    }

    sound.stops = stops.slice()
    this.fire('set-sound-stops', { sound, stops: sound.stops.slice() })
    sound.fire('set-sound-stops', { sound, stops: sound.stops.slice() })
  }

  resetSoundStops({ sound, index }: { sound: Sound, index?: number }) {
    if (!sound) { return }

    this.stop()

    const resetStops = sound.getDefaultStops()
    if (typeof index !== 'undefined' && !isNaN(index)) {
      sound.stops[index] = resetStops[index]

      if (index === 1) {
        sound.stops[0] = Math.min(sound.stops[0], resetStops[index])
      } else if (index === 3) {
        sound.stops[2] = Math.max(sound.stops[3], resetStops[index])
      }
    } else {
      sound.stops = resetStops
    }

    this.fire('set-sound-stops', { sound, stops: sound.stops.slice() })
    sound.fire('set-sound-stops', { sound, stops: sound.stops.slice() })
  }

  setSoundGain({ sound, gain }: { sound: Sound, gain: number }) {
    if (!sound) { return }
    sound.gain = gain
    const nodes = this.audioNodeMap.get(sound)
    if (nodes?.gain) {
      nodes.gain.gain.setValueAtTime(gain * (sound.muted ? 0 : 1), 0)
    }
    this.fire('set-gain', { sound, gain })
    sound.fire('set-gain', { sound, gain })
  }

  setSoundPan({ sound, pan }: { sound: Sound, pan: number }) {
    if (!sound) { return }
    sound.pan = pan
    const nodes = this.audioNodeMap.get(sound)
    if (nodes?.pan) {
      nodes.pan.pan.setValueAtTime(pan, 0)
    }
    this.fire('set-pan', { sound, pan })
    sound.fire('set-pan', { sound, pan })
  }

  resetSoundGain({ sound }: { sound: Sound }) {
    this.setSoundGain({ sound, gain: 1 })
  }
  
  resetSoundPan({ sound }: { sound: Sound }) {
    this.setSoundPan({ sound, pan: 0 })
  }

  setSoundMuted({ sound, muted = false }: { sound: Sound, muted?: boolean }) {
    sound.muted = muted 
    sound.fire('set-muted', { sound, muted })
    this.setSoundGain({ sound, gain: sound.gain })
  }

  toggleSoundMuted({ sound }: { sound: Sound, muted?: boolean }) {
    this.setSoundMuted({ sound, muted: !sound.muted }) 
  }

  setSoundSoloed({ sound, soloed = false }: { sound: Sound, soloed?: boolean }) {
    sound.soloed = soloed 
    sound.fire('set-soloed', { sound, soloed })
  }

  toggleSoundSoloed({ sound }: { sound: Sound, soloed?: boolean }) {
    this.setSoundSoloed({ sound, soloed: !sound.soloed }) 
  }

  setSoundMs({ sound, ms }: { sound: Sound, ms: number }) {
    sound.ms = ms
    this.fire('set-sound-ms', { sound, ms })
    sound.fire('set-sound-ms', { sound, ms })
  }

  setSoundFrames({ sound, frames }: { sound: Sound, frames: Frames }) {
    sound.frames = frames
    this.fire('set-sound-frames', { sound, frames })
    sound.fire('set-sound-frames', { sound, frames })
  }

  setSoundFile({ 
    file,
    audioBuffer,
    frames,
    ms,
    sound
  }: { 
    file: File,
    audioBuffer: AudioBuffer,
    frames?: Frames,
    ms?: number,
    sound: Sound 
  }) {
    sound.file = file
    if (frames) { this.setSoundFrames({ sound, frames }) }

    if (ms) { 
      this.setSoundMs({ sound, ms })
    }

    sound.audioBuffer = audioBuffer

    this.fire('set-sound-file', { sound, audioBuffer, file, frames, ms })
    sound.fire('set-sound-file', { sound, audioBuffer, file, frames, ms })

    this.routeSingleSound({ sound })
  }

  playSounds(offset?: number): number {
    if (!this.sounds.length) { return 0 }

    let startedSounds = 0
    for (const sound of this.sounds) {
      startedSounds += this.queueSingleSound({
        sound,
        offset 
      }) ? 1 : 0
    }

    return startedSounds
  }

  playSingleSound({ sound, offset }: { sound: Sound, offset?: number }): boolean {
    return !!this.queueSingleSound({ sound, offset })
  }

  routeSingleSound({ 
    sound,
    audioCtx = this.audioCtx,
    destination = this.destination || this.audioCtx.destination
  }: { 
    sound: Sound,
    audioCtx?: AudioContext,
    destination?: AudioNode,
    start?: number
  }) {
    if (!sound.file || !destination || !audioCtx) { return }

    /* use the soundNodes/paramValues directly from the sound object */
    const pan = audioCtx.createStereoPanner()

    const gain = audioCtx.createGain()

    gain.connect(pan).connect(destination)

    this.audioNodeMap.set(sound, {
      gain,
      pan
    })

    return sound
  }

  queueSingleSound({ 
    sound,
    offset = 0, /* this offset moves the loopStart position */ 
    audioCtx = this.audioCtx
  }: { 
    sound: Sound,
    offset?: number,
    audioCtx?: AudioContext
  }) {
    if (this.exclusions.has(sound.uid)) { return }

    const nodes = this.audioNodeMap.get(sound)
    if (!nodes) { return }

    const { pan, gain } = nodes
    const audioBuffer = sound.audioBuffer
    if (!audioBuffer || !pan || !gain ) { return }

    let stops = sound.stops.slice()
    if (stops.length !== 4) {
      stops = sound.getDefaultStops()
    }

    const loopLocalPlayhead = this._getPlayhead(true)
    const loopStart = this._getLoopStart()
    const currentTime = this.audioCtx.currentTime

    const soundLocalPlayhead = stops[1] + loopLocalPlayhead - offset

    if (soundLocalPlayhead >= stops[3]) { return }

    const lToA = (value: number): number => {
      /* sound file local to startTime=zero absolute */
      return value - stops[1] + offset - loopStart
    }

    const phr = (value: number): number => {
      /* playhead relative */
      return value - loopLocalPlayhead + loopStart
    }

    pan.pan.setValueAtTime(sound.pan, 0)

    gain.gain.setValueAtTime(sound.gain * (sound.muted ? 0 : 1), 0)

    const source = audioCtx.createBufferSource()
    source.buffer = audioBuffer

    const env = audioCtx.createGain()

    source.connect(env).connect(gain)

    /* cache for stopping (pausing / stopping) */
    source.addEventListener('ended', () => {
      env.disconnect()
      this.activeSources.delete(source)
      if (!this.activeSources.size && this.loopLength <= 0) {
        if (this.mapPlayState() === 'paused') {
          this.pause()
        } else {
          this.stop()
        }
      }
    })

    this.activeSources.set(source, env)

    /* 
     * lerping here is required in order to start at the correct gain value
     * if the playhead is set between the fades and the extents
     */
    if (soundLocalPlayhead < stops[0]) {
      env.gain.setValueAtTime(0, 0)
    }

    const lerp = (start: number, end: number, value: number): number => {
      if (!(end - start)) { return 1 }
      return Math.max(0, Math.min(1, (value - start) / (end - start)))
    }

    stops.push(soundLocalPlayhead)
    const times = stops.map(stop => Math.max(0, phr(lToA(stop))) / 1000)
    const adjAmount = 0.02

    if (soundLocalPlayhead < stops[1]) {
      let adj = 0
      if (soundLocalPlayhead > stops[0]) {
        /* ramp env when starting to play to smooth out */
        env.gain.setValueAtTime(0, 0)
        env.gain.linearRampToValueAtTime(1, currentTime + adjAmount)
        adj = adjAmount
      }
      const gainAtStart = lerp(stops[0], stops[1], soundLocalPlayhead + adj)
      env.gain.setValueAtTime(gainAtStart, currentTime + Math.max(times[0], times[4]) + adj)
      env.gain.linearRampToValueAtTime(1, currentTime + times[1])
    } else if (soundLocalPlayhead <= stops[2]) {
      /* ramp env when starting to play to smooth out */
      env.gain.setValueAtTime(0, 0)
      env.gain.linearRampToValueAtTime(1, currentTime + adjAmount)
    }

    if (soundLocalPlayhead < stops[3]) {
      let adj = 0
      if (soundLocalPlayhead > stops[2]) {
        /* ramp env when starting to play to smooth out */
        env.gain.setValueAtTime(0, 0)
        env.gain.linearRampToValueAtTime(1, currentTime + adjAmount)
        adj = adjAmount
      }
      const gainAtEnd = lerp(stops[3], stops[2], soundLocalPlayhead + adj)
      env.gain.setValueAtTime(gainAtEnd, currentTime + Math.max(times[2], times[4]) + adj)
      env.gain.linearRampToValueAtTime(0, currentTime + times[3])
    }
    
    const args = [
      Math.max(0, currentTime + phr(lToA(stops[0])) / 1000),
      Math.max(0, stops[0], soundLocalPlayhead) / 1000,
      Math.min(stops[3] - stops[0], stops[3] - soundLocalPlayhead) / 1000
    ]

    source.start(...args) 

    /*
    args[0] -= currentTime
    args.push(soundLocalPlayhead)
    args.push(loopLocalPlayhead)
    args.push(offset)
    args.push(loopStart)

    console.log(args.join('\n'))
    */

    return sound
  }

  setPlayhead(ms: number) {
    this.playheadBase = ms
    this.playhead = ms
    this.fire('set-playhead', { base: this.playheadBase, ms })

    /* restart playing all sounds but at the correct offset with the playhead */
    if (this.mapPlayState() === 'playing') { 
      this.pause()
      this.play()
    }

    for (const [ transport, offset ] of this.syncs) {
      transport.setPlayhead(Math.max(0, ms + offset - this._getLoopStart()))
    }

    return this
  }

  beginLooping(offset = 0) {
    /* schedule audio for one loop ahead and then recursively call */
    const queue = (offset = 0) => {
      if (this.loopLength > 0 && this.mapPlayState() === 'playing') {
        this.playSounds(this.loopLength + offset)
        this.loopTimerId = window.setTimeout(() => {
          queue()
        }, this.loopLength + offset - this._getPlayhead(true) + Math.min(1000, this.loopLength / 2))
        /* 
         * a note about the above timeout: scheduling should always take place
         * well after the loop has begun in order to avoid a double-queue
         * scheduling is absolute anyway, so the audio will be queued
         * precisely; all that matters is that the queueing happens after the
         * loop starts. That is why Min(one second, loopLength / 2) is added
         */
      }
    }
    queue(offset)
  }

  setExclusions({ soundUids }: { soundUids: string[] }) {
    this.exclusions.clear()
    for (const soundUid of soundUids) {
      this.exclusions.add(soundUid) 
    }
  }

  mapPlayState(state = this.playState) { return state }

  setPlayState(state: string, offset = 0) {
    if (this.mapPlayState() === 'stopped' &&
        state === 'stopped' && 
        this.playhead === this.playheadBase) {
      this.playhead = 0
      this.playheadBase = 0
      this.fire('set-playhead', { base: this.playheadBase, ms: this.playhead })
      return this
    }

    if (this.playState === state) { return this } 

    if (this.audioCtx.state === 'suspended') { this.audioCtx.resume() }

    this.playState = state
    this.fire('set-play-state', { playState: state })

    switch (this.mapPlayState(state)) {
    case 'playing': 
      /* 
       * subtract off playhead to compensate for non-zero playhead position
       * playheadNow = currentTime - (currentTimeAtStart - playheadAtStart)
       */
      this.startTime = this.audioCtx.currentTime * 1000 - this.playhead + offset
      this.playSounds()
      if (this.loopLength > 0) {
        this.beginLooping()
      }
      this.updatePlayhead()
      break
    case 'paused':
    case 'stopped':
      /* stop all currently-playing source nodes */
      this.playhead = this._getPlayhead() + offset
      window.clearTimeout(this.loopTimerId)
      for (const [ source, envelope ] of this.activeSources) {
        envelope.gain.cancelScheduledValues(0)
        envelope.disconnect()
        try {
          source.disconnect()
          source.stop()
        } catch (err) {
          /* do nothing */
        }
      }

      this.activeSources.clear()
      this.exclusions.clear()

      /* this is the only difference between the two functions */
      if (this.mapPlayState() === 'stopped') {
        /* reset the playhead to the playheadBase and fire event */
        this.playhead = this.playheadBase
        this.fire('set-playhead', { base: this.playheadBase, ms: this.playhead })
      }
      break
    } 

    for (const [ transport, offset ] of this.syncs) {
      transport.setExclusions({ soundUids: this.sounds.map(sound => sound.uid) })
      transport.setPlayState(this.mapPlayState(), Math.max(0, offset + this._getLoopStart()))
    }

    return this
  }

  setDestination({ destination }: { destination: AudioNode }) {
    this.destination = destination
    /* 
     * go through all sounds and re-route the pan (last) node to the new
     * destination
     */
    for (const { pan } of this.audioNodeMap.values()) {
      pan.disconnect()
      pan.connect(destination)
    }
    return this
  }

  setSounds({ sounds }: { sounds: Sound[] }) {
    this.stop()
    this.sounds = sounds.slice()
    /* clear the audioNodeMap and re-route everything */

    /* 
     * TODO: diff the nodeMap and only change based on diff between current
     * state and new state to avoid re-reouting everything again
     */
    this.audioNodeMap.clear()
    for (const sound of sounds) { 
      this.routeSingleSound({
        sound
      })
    }
    return this
  }

  /* request animation frame updates to update the play head */
  updatePlayhead() {
    if (this.mapPlayState() === 'playing') {
      const result = Math.max(0, this._getPlayhead(true) + this._getLoopStart())
      this.fire('set-playhead', { base: this.playheadBase, ms: result })
      window.requestAnimationFrame(() => {
        this.updatePlayhead()
      })
    }
  }

  _getPlayhead(loopLocal = false): number {
    let diff = this.audioCtx.currentTime * 1000 - this.startTime
    if (loopLocal && this.loopLength > 0) {
      diff -= this._getLoopStart() + this.loopLength * Math.max(0, Math.floor((diff - this._getLoopStart()) / this.loopLength))
      if (diff > 0) {
        diff = diff % this.loopLength
      } 
    }
    return diff
  }

  play() {
    this.setPlayState('playing')
    return this
  }
  
  pause() {
    this.setPlayState('paused')
    return this
  }

  playPause() {
    if (this.mapPlayState() === 'playing') {
      this.pause()
    } else { 
      this.play()
    }
    return this
  }

  stop() {
    this.setPlayState('stopped')
    return this
  }

  setLoopLength({ loopLength }: { loopLength: number}) {
    this.loopLength = loopLength
    this.fire('set-loop-length', { loopLength })
    return this
  }

  sync(transport: Transport, offset = 0) {
    /* prevent infinite loop */
    if (transport.syncs.has(this)) { return }

    this.syncs.set(transport, offset)
    transport.setPlayState(this.mapPlayState())
  }

  unsyncAll() {
    for (const transport of this.syncs.keys()) {
      transport.stop()
    }
    this.syncs.clear()
  }

  leadIn(offset = 0) {
    this.loopStart = offset
    return this
  }

  _getLoopStart() {
    return this.loopStart
    // return this.sounds.reduce((time, sound) => Math.max(time, sound.stops[1] - sound.stops[0]), this.loopStart)
  }

  getPlayState() { return this.playState }

}

export default Transport
