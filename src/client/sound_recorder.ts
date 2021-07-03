import Transport, { TransportParams } from './sound_transport'
import Metro from './metro'

/*
 * typescript doesn't have this interface defined even though it's been around
 * for like five years 
 */
declare const MediaRecorder: any

interface SoundRecorderParams extends TransportParams {
  audioCtx: AudioContext
  measures: number
  metro: Metro
  deviceId: string
}

class SoundRecorder extends Transport {
  playState = 'stopped'
  metro: Metro
  measures = 4
  syncs = new Map<Transport, number>()
  deviceId: string

  metroGain: GainNode
  audioBuffer?: AudioBuffer

  totalLength?: number

  _stopRecording?: () => void

  constructor({ 
    audioCtx,
    measures,
    sounds,
    deviceId,
    metro
  }: SoundRecorderParams) {
    super({
      sounds,
      audioCtx
    })

    this.measures = measures
    this.metroGain = audioCtx.createGain()
    this.metro = metro 
    this.deviceId = deviceId
  }

  setLoopLength({ loopLength }: { loopLength: number}) {
    super.setLoopLength({ loopLength })

    /* add one measure on the (front) and 2000 ms off the end */
    this.totalLength = loopLength + this.metro.getPatternLength() + 2000

    this.audioBuffer = this.audioCtx.createBuffer(1, 48000 * (this.totalLength / 1000), 48000)

    return this
  }

  async startRecording(): Promise<AnalyserNode> {

    const stream = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: this.deviceId } })

    const analyzer = this.audioCtx.createAnalyser()
    const mediaStreamNode = this.audioCtx.createMediaStreamSource(stream)
    mediaStreamNode.connect(analyzer)

    const recorder = new MediaRecorder(stream)

    recorder.start(100)

    this.fire('start-recording', { analyzer })

    let updateId = -1
    const startTime = this.audioCtx.currentTime
    const frames = []
    const chunks = new Array<Blob>()

    recorder.addEventListener('dataavailable', async ({ data }: { data: Blob }) => {
      chunks.push(data)
    })
    recorder.addEventListener('stop', () => {
      const file = new File(chunks, `${this.sounds[0].uid}`, {
        type: recorder.mimeType
      })
      this.fire('stop-recording', { file })
    })

    this._stopRecording = () => {
      /* do nothing I guess */
      window.clearTimeout(updateId)
      recorder.stop()
      analyzer.disconnect()
      mediaStreamNode.disconnect()
    }


    const update = () => {
      const data = new Uint8Array(2048)
      analyzer.getByteTimeDomainData(data)
      let min = 127
      let max = 127
      for (const val of data) {
        min = Math.min(val, min)
        max = Math.max(val, max)
      }
      frames.push({
        min: min - 127,
        max: max - 127,
        ts: (this.audioCtx.currentTime - startTime) * 1000 
      })
      updateId = window.setTimeout(update, 100)
    }
    update()

    return analyzer

  }

  stopRecording() {
    if (this._stopRecording) {
      this._stopRecording()
      this._stopRecording = undefined
    }
  }

  async _setPlayState(state: string) {
    await this.metro.getClicks('click')

    this.playState = state
    this.fire('set-play-state', { playState: state })

    switch (state) {
    case 'playing':
    {

      this.metro.previewMetroStart({})
      this.startRecording()
      /* stop recording at limit of length */
      setTimeout(() => {
        this.stop()
      }, (this.totalLength || this.loopLength))
      break
    }
    default:
      this.metro.previewMetroStop()
      this.stopRecording()
      break
    }

    for (const [ transport, offset ] of this.syncs) {
      transport.setExclusions({ soundUids: this.sounds.map(sound => sound.uid) })
      transport.setPlayState(this.playState, offset)
    }
  }

  setPlayState(state: string) {
    if (this.playState === state || !this.sounds[0]) { return this } 

    if (this.audioCtx.state === 'suspended') { this.audioCtx.resume() }
    
    this._setPlayState(state)

    return this
  }

  play() {
    return this.setPlayState('playing')
  }

  pause() {
    /* there is no pausing the recording */
    return this.stop()
  }

  playPause() {
    /* there is no pausing the recording */
    if (this.playState === 'playing') {
      this.stop()
    } else { 
      this.play()
    }
    return this
  }

  stop() { 
    return this.setPlayState('stopped')
  }

  setPlayhead() {
    /* this is a noop */
    return this
  }

  getPlayState() {
    return this.playState
  }
}

export default SoundRecorder
