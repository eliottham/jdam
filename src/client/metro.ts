import Evt from './evt'

export interface MetroPreviewParams {
  bpm?: number
  pattern?: number[] 
  destination?: AudioNode
}

class Metro extends Evt {
  clickHigh?: AudioBuffer
  clickLow?: AudioBuffer

  /* cache this and noop if there is another attempt to load the same files */
  clickPrefixName = ''

  bpm = 120
  pattern = [ 2, 1, 1, 1 ]
  _loopTimerId = -1
  playing = false
  startTime = 0
  beat = 0
  activeSources = new Set<AudioBufferSourceNode>()

  audioCtx = new AudioContext()
  destination: AudioNode

  constructor(params?: MetroPreviewParams) {
    super()

    if (params) {
      Object.assign(this, params)
    }

    this.destination = params?.destination || this.audioCtx.destination
  }

  getPatternLength() {
    return this.pattern.length * (60 / this.bpm) * 1000
  }

  async getClick(prefix: string, suffix: string) {
    /* 
     * where prefix is the name of the click and
     * suffix is whether it is "high" or "low"
     */
    try {
      const response = await fetch(`/waves/clicks?name=${prefix}&type=${suffix}`, {
        method: 'GET'
      })
      const blob = await response.blob()
      return await blob.arrayBuffer()
    } catch (err) {
      /* do nothing */
    }
  }

  convertU24LEtoS32Float(buffer: ArrayBuffer) {
    const float32 = new Float32Array(buffer.byteLength / 3)
    const divisor = 0x7FFFFF
    let index = 0
    for (let b = 0; b < buffer.byteLength / 3; b += 3) {
      const bytes = new Uint8Array(buffer.slice(b, b + 3))
      const sign = ((bytes[2] >> 7) & 0b1) ? true : false
      let result = bytes[2] << 16 | bytes[1] << 8 | bytes[0]
      if (sign) { result = result | (0xFF << 24) }
      float32[index] = result / divisor
      index++
    }
    return float32
  }

  createAudioBuffer(arrayBuffer: ArrayBuffer) {
    const float32 = this.convertU24LEtoS32Float(arrayBuffer)
    const newBuffer = new AudioBuffer({
      sampleRate: 48000,
      length: float32.length
    })

    newBuffer.copyToChannel(float32, 0)
    return newBuffer
  }

  async getClicks(prefix: string) {
    
    /* load click files and create audio buffers for each; cache for reuse */
    if (prefix === this.clickPrefixName) {
      this.fire('get-clicks', { clicks: [ this.clickHigh, this.clickLow ] })
      return [ this.clickHigh, this.clickLow ]
    }

    const [ clickHigh, clickLow ] = await Promise.all([ this.getClick(prefix, 'high'), this.getClick(prefix, 'low') ])

    this.clickPrefixName = prefix

    if (clickHigh) { 
      this.clickHigh = this.createAudioBuffer(clickHigh)
    }
    if (clickLow) { 
      this.clickLow = this.createAudioBuffer(clickLow)
    }

    this.fire('get-clicks', { clicks: [ clickHigh, clickLow ] })
    return [ clickHigh, clickLow ]
  }
  
  queueMetroBeats() {
    if (!this.clickHigh || !this.clickLow) { throw Error('metro clicks are not loaded') }
    const offset = 60 / this.bpm
    for (const patternMark of this.pattern) {
      if (patternMark) {
        const bufferSource = this.audioCtx.createBufferSource()
        bufferSource.buffer = patternMark === 2 ? this.clickHigh : this.clickLow
        bufferSource.connect(this.destination)
        bufferSource.start(this.startTime + offset * this.beat)
        this.activeSources.add(bufferSource)
        bufferSource.addEventListener('ended', () => {
          this.activeSources.delete(bufferSource)
        })
      }
      this.beat ++
    }
  }

  previewMetroSet({ bpm = this.bpm, pattern = this.pattern }: MetroPreviewParams) {
    this.bpm = bpm
    this.pattern = pattern
  }

  previewMetroStart({ bpm = this.bpm, pattern = this.pattern }: MetroPreviewParams) {
    this.previewMetroSet({ bpm, pattern })

    if (this.playing) {
      return
    }

    this.playing = true
    this.startTime = this.audioCtx.currentTime
    this.beat = 0
    this.queueMetroBeats()
    const loop = () => {
      this._loopTimerId = window.setTimeout(() => {
        try {
          this.queueMetroBeats()
          loop()
        } catch (err) {
          /* do nothing for now */
          this.previewMetroStop()
        }
      }, this.getPatternLength())
    }
    loop()
    this.fire('metro-start', { bpm, pattern })
  }

  previewMetroStop() {
    window.clearTimeout(this._loopTimerId)
    for (const source of this.activeSources) {
      source.stop()
    }
    this.activeSources.clear()
    this.playing = false
    this.fire('metro-stop', {})
  }
}

export default Metro
