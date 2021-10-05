import Evt from './evt'
import UID from './uid'

export type Frames = Array<{
  min: number,
  max: number,
  ts?: number
}>

export interface SoundParams {
  uid?: string
  name?: string
  gain?: number
  pan?: number
  ownerNode?: string
  file?: File
  stops?: number[]
  accountId?: string
  muted?: boolean
  soloed?: boolean
  fromParent?: boolean
  frames?: Frames
  ms?: number
  audioBuffer?: AudioBuffer
  canEdit?: boolean
  canRecord?: boolean
}

class Sound extends Evt {
  uid = ''
  name = ''
  gain = 1
  pan = 0
  muted = false
  soloed = false
  fromParent = false
  accountId?: string
  canEdit = false
  canRecord = false
  ownerNode?: string
  /* the sound file */
  file?: File
  audioBuffer?: AudioBuffer
  frames?: Frames
  ms?: number

  /* 
   * milliseconds in to the sound clip with define:
   * [0]: start extent, -inf db
   * [1]: loop start, 0 db
   * [2]: loop end, 0 db
   * [3]: end extent, -inf db
   */
  stops: number[] = []

  constructor(params: SoundParams) {
    super ()

    Object.assign(this, params)
  }
  
  copy(newUid = false) {
    return new Sound({
      uid: newUid ? UID.hex(24) : this.uid,
      name: this.name,
      gain: this.gain,
      pan: this.pan,
      ownerNode: this.ownerNode,
      stops: this.stops.slice(),
      accountId: this.accountId,
      ms: this.ms,
      file: this.file,
      frames: this.frames?.slice(),
      muted: this.muted,
      soloed: this.soloed,
      fromParent: this.fromParent,
      audioBuffer: this.audioBuffer,
      canEdit: this.canEdit,
      canRecord: this.canRecord
    })
  }

  getDefaultStops(): number[] {
    const ms = this.ms || 1000
    return [ 0, 100, ms - 100, ms ]
  }

  getPrettyName(ext = ''): string {
    if (!this.name) { return this.uid }

    if (this.file && !ext) {
      ext = this.file.type.split(';')[0].split('/')[1]
    }

    if (!ext) { ext = 'flac' }

    return `${this.name.toLowerCase().replace(/\s+/g, '_')}.${ext}`
  }

}

export default Sound
