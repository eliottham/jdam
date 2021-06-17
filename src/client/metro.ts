import Evt from './evt'

type PreviewParams = {
  bpm?: number
  pattern?: number[] 
}

class Metro extends Evt {
  clickHigh?: AudioBuffer
  clickLow?: AudioBuffer

  /* cache this and noop if there is another attempt to load the same files */
  clickPrefixName = ''

  _bpm = 120
  _pattern = [ 2, 1, 1, 1 ]
  _loopTimerId = -1
  _playing = false

  audioCtx = new AudioContext()

  async getClick(prefix: string, suffix: string) {
    /* 
     * where prefix is the name of the click and
     * suffix is whether it is "high" or "low"
     */
    try {
      const response = await fetch(`processor/clicks?name=${prefix}&type=${suffix}`, {
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
  
  previewMetro({ bpm = 120, pattern = [ 2, 1, 1, 1 ] }: PreviewParams) {
    if (this.audioCtx.state === 'closed') { throw Error('audioCtx is already closed') }
    if (!this.clickHigh || !this.clickLow) { throw Error('metro clicks are not loaded') }
    let time = 0
    const offset = 60 / bpm
    for (const patternMark of pattern) {
      if (patternMark) {
        const bufferSource = this.audioCtx.createBufferSource()
        bufferSource.buffer = patternMark === 2 ? this.clickHigh : this.clickLow
        bufferSource.connect(this.audioCtx.destination)
        bufferSource.start(this.audioCtx.currentTime + time)
      }
      time += offset
    }
  }

  previewMetroSet({ bpm = this._bpm, pattern = this._pattern }: PreviewParams) {
    this._bpm = bpm
    this._pattern = pattern
  }

  previewMetroStart({ bpm = this._bpm, pattern = this._pattern }: PreviewParams) {
    this.previewMetroSet({ bpm, pattern })

    if (this._playing) {
      return
    }

    this.audioCtx = new AudioContext()

    this._playing = true
    this.previewMetro({ bpm, pattern })
    const loop = () => {
      this._loopTimerId = window.setTimeout(() => {
        try {
          this.previewMetro({ bpm: this._bpm, pattern: this._pattern })
          loop()
        } catch (err) {
          /* do nothing for now */
          this.previewMetroStop()
        }
      }, this._pattern.length * (60 / this._bpm) * 1000)
    }
    loop()
    this.fire('metro-start', { bpm, pattern })
  }

  previewMetroStop() {
    try {
      if (this.audioCtx.state !== 'closed') {
        this.audioCtx.close()
      }
    } catch (err) {
      /* do nothing for now */
    }
    window.clearTimeout(this._loopTimerId)
    this._playing = false
    this.fire('metro-stop', {})
  }
}

export default Metro
