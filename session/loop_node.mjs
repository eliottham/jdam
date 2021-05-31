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
