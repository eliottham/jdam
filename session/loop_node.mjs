import crypto from 'crypto'

function randomUid() {
  const byteBuffer = Buffer.allocUnsafe(24) 
  crypto.randomFillSync(byteBuffer)
  return byteBuffer.toString('base64')
}

/* DATA-ONLY CLASS, no self-mutating functions allowed 
 *
 * all that stuff will be controlled in the session module instead
 */
class Sound {
  constructor() {
    this.uid = randomUid()
    /* the sound buffer */
    this.buffer = new Uint8Array(new ArrayBuffer(0))

    /* indices into the array buffer which define
     * [0]: start extent, -inf db
     * [1]: loop start, 0 db
     * [2]: loop end, 0 db
     * [3]: end extent, -inf db
     *
     * when uploading & recording, 0 and 3 will be non-zero
     * but after trimming, they should be 0 and buffer.length - 1
     */
    this.stops = []
  }
}

/* DATA-ONLY CLASS, no self-mutating functions allowed 
 *
 * all that stuff will be controlled in the session module instead
 */
class LoopNode {
  constructor({ children, parent, uid } = {}) {
    this.children = []
    this.sounds = new Set() /* uid references (budget-pointers) to sound objects */
    this.selectedNode = 0
    if (uid) { this.uid = uid }
    else { this.uid = randomUid() }
    
    if (children) { this.children = children }
    if (parent) { this.parent = parent }
  }

  getSelectedNode() {
    if (!this.children.length) { return undefined }

    return this.children[this.selectedNode]
  }

  getChain() {
    const result = [ this ]
    const recurse = (node) => {
      const selectedNode = node.getSelectedNode()
      if (selectedNode) {
        result.push(selectedNode)
        recurse(selectedNode)
      }
    }
    recurse(this)
    return result
  }
}

export default LoopNode
export { Sound }
