class Sound {
  udid = ''
  /* the sound buffer */
  buffer: Uint8Array = new Uint8Array(new ArrayBuffer(0))

  /* indices into the array buffer which define
   * [0]: start extent, -inf db
   * [1]: loop start, 0 db
   * [2]: loop end, 0 db
   * [3]: end extent, -inf db
   *
   * when uploading & recording, 0 and 3 will be non-zero
   * but after trimming, they should be 0 and buffer.length - 1
   */
  stops: number[] = []
}

interface LoopNodeParams {
  children: LoopNode[] | undefined
}

class LoopNode {
  children: LoopNode[] = []
  parent: LoopNode | undefined
  sounds: Sound[] = []

  constructor(params: LoopNodeParams) {
    if (params.children) this.children = params.children
  }

  inheritFrom(parent: LoopNode | undefined) {
    this.parent = parent 
  }
}

export default LoopNode
