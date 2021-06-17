import Sound, { Frames } from './sound'
import Evt from './evt'

interface TransportParams {
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
    audioBuffer: AudioBuffer,
    gain: GainNode,
    pan: StereoPannerNode
  }>()
  activeSources = new Map<AudioBufferSourceNode, GainNode>()
  scheduling = false
  loopLength = -1
  loopTimerId = -1
  loopStart = 0
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

  setScheduling(scheduling: boolean) {
    this.scheduling = scheduling
    this.fire('set-scheduling', { scheduling })
    return this
  }

  setSoundStops({ sound, stops }: { sound: Sound, stops: number[] }) {
    if (!sound) { return }

    if (this.playState !== 'stopped') {
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
      } else if (index === 2) {
        sound.stops[3] = Math.max(sound.stops[3], resetStops[index])
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
      nodes.gain.gain.setValueAtTime(gain, 0)
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

  setSoundFile({ file, frames, ms, sound }: { file: File, frames?: Frames, ms?: number, sound: Sound }) {
    sound.file = file
    if (frames) { sound.frames = frames }

    if (ms) { 
      sound.ms = ms 
    }

    this.fire('set-sound-file', { sound, file, frames, ms })
    sound.fire('set-sound-file', { sound, file, frames, ms })

    this.routeSingleSound({ sound })
  }

  playSounds(offset?: number): number {
    if (!this.sounds.length) { return 0 }

    let startedSounds = 0
    for (const sound of this.sounds) {
      startedSounds += this.queueSingleSound({
        sound,
        scheduled: this.scheduling,
        offset 
      }) ? 1 : 0
    }

    return startedSounds
  }

  playSingleSound({ sound, offset }: { sound: Sound, offset?: number }): boolean {
    return !!this.queueSingleSound({ sound, offset })
  }

  async routeSingleSound({ 
    sound,
    audioCtx = this.audioCtx,
    destination = this.destination || this.audioCtx.destination
  }: { 
    sound: Sound,
    audioCtx?: AudioContext,
    destination?: AudioNode,
    scheduled?: boolean,
    start?: number
  }) {
    if (!sound.file || !destination || !audioCtx) { return }

    const arrayBuffer = await sound.file.arrayBuffer()
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer)

    if (!audioBuffer) { return }


    /* use the soundNodes/paramValues directly from the sound object */
    const pan = audioCtx.createStereoPanner()

    const gain = audioCtx.createGain()

    gain.connect(pan).connect(destination)

    this.audioNodeMap.set(sound, {
      audioBuffer,
      gain,
      pan
    })

    return sound
  }

  queueSingleSound({ 
    sound,
    scheduled = this.scheduling, /* whether to play normally or schedule at stops[1] */
    offset = 0, /* this offset moves the loopStart position */ 
    audioCtx = this.audioCtx
  }: { 
    sound: Sound,
    scheduled?: boolean,
    offset?: number,
    audioCtx?: AudioContext
  }) {
    const nodes = this.audioNodeMap.get(sound)
    if (!nodes) { return }

    const { audioBuffer, pan, gain } = nodes
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

    gain.gain.setValueAtTime(sound.gain, 0)

    const source = audioCtx.createBufferSource()
    source.buffer = audioBuffer

    const env = audioCtx.createGain()

    source.connect(env).connect(gain)

    /* cache for stopping (pausing / stopping) */
    source.addEventListener('ended', () => {
      env.disconnect()
      this.activeSources.delete(source)
      if (!this.activeSources.size && this.loopLength <= 0) {
        if (this.playState === 'paused') {
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

    if (soundLocalPlayhead < stops[1]) {
      const gainAtStart = lerp(stops[0], stops[1], soundLocalPlayhead)
      env.gain.setValueAtTime(gainAtStart, currentTime + Math.max(times[0], times[4]))
      env.gain.linearRampToValueAtTime(1, currentTime + times[1])
    } else if (soundLocalPlayhead <= stops[2]) {
      env.gain.setValueAtTime(1, 0)
    }

    if (soundLocalPlayhead < stops[3]) {
      const gainAtEnd = lerp(stops[3], stops[2], soundLocalPlayhead)
      env.gain.setValueAtTime(gainAtEnd, currentTime + Math.max(times[2], times[4]))
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
    if (this.playState === 'playing') { 
      this.pause()
      this.play()
    }

    for (const [ transport, offset ] of this.syncs) {
      transport.setPlayhead(ms - offset)
    }

    return this
  }

  beginLooping(offset = 0) {
    /* schedule audio for one loop ahead and then recursively call */
    const queue = (offset = 0) => {
      if (this.loopLength > 0 && this.playState === 'playing') {
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

  setPlayState(state: string, offset = 0) {
    if (this.playState === 'stopped' &&
        state === 'stopped' && 
        this.playhead === this.playheadBase) {
      this.playhead = 0
      this.playheadBase = 0
      this.fire('set-playhead', { base: this.playheadBase, ms: this.playhead })
      return this
    }

    if (this.playState === state) { return this } 

    if (this.audioCtx.state === 'suspended') { this.audioCtx.resume() }

    const lastState = this.playState
    this.playState = state
    this.fire('set-play-state', { playState: state })

    switch (this.playState) {
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

      /* this is the only difference between the two functions */
      if (this.playState === 'stopped') {
        /* reset the playhead to the playheadBase and fire event */
        this.playhead = this.playheadBase
        this.fire('set-playhead', { base: this.playheadBase, ms: this.playhead })
      }
      break
    } 

    for (const [ transport, offset ] of this.syncs) {
      transport.setPlayState(this.playState, Math.max(0, offset + this._getLoopStart()))
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

  async setSounds({ sounds }: { sounds: Sound[] }) {
    this.stop()
    this.sounds = sounds.slice()
    /* clear the audioNodeMap and re-route everything */

    /* 
     * TODO: diff the nodeMap and only change based on diff between current
     * state and new state to avoid re-reouting everything again
     */
    this.audioNodeMap.clear()
    await Promise.all(sounds.map(sound => {
      return this.routeSingleSound({
        sound
      })
    }))
    return this
  }

  /* request animation frame updates to update the play head */
  updatePlayhead() {
    if (this.playState === 'playing') {
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
    if (this.playState === 'playing') {
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
    transport.setPlayState(this.playState)
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
