import LoopNode from './loop_node'
import Evt from './evt'

export interface SoundParams {
  uid?: string
  name?: string
  gain?: number
  pan?: number
  ownerNode?: LoopNode
  file?: File
  stops?: number[]
  accountId?: string
  muted?: boolean
  soloed?: boolean
  fromParent?: boolean
  ms?: number
}

export type Frames = Array<{
  min: number,
  max: number
}>

class Sound extends Evt {
  uid = ''
  name = ''
  gain = 1
  pan = 0
  muted = false
  soloed = false
  fromParent = false
  accountId?: string
  ownerNode?: LoopNode
  /* the sound file */
  file?: File
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

  getDefaultStops(): number[] {
    const ms = this.ms || 1000
    return [ 0, 100, ms - 100, ms ]
  }

}

export default Sound
