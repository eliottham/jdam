import Evt from './evt'
import Session from './session'

interface LoopNodeParams {
  children?: LoopNode[]
  parent?: LoopNode
  session?: Session
  uid: string
}

class LoopNode extends Evt {
  children: LoopNode[] = []
  selectedNode = 0 /* index in children array */
  parent: LoopNode | undefined
  sounds: Set<string> = new Set() /* references to uid only, sounds will be stored on client in a map */
  uid = ''
  session?: Session

  constructor({ children, parent, uid, session }: LoopNodeParams) {
    super()

    if (children) { this.children = children }
    if (parent) { this.inheritFrom(parent) }
    if (session) { this.session = session }
    this.uid = uid
  }

  inheritFrom(parent: LoopNode) {
    this.parent = parent 
  }

  setSelectedNode(index: number) {
    if (index < 0 || index >= this.children.length) { return }

    this.selectedNode = index
    this.fire('set-selected-node', { index: this.selectedNode, node: this.children[index] })
  }

  setChildren(children: LoopNode[]) {
    this.children = children
    this.fire('set-children', { node: this, children })
  }

  addChild(child: LoopNode) {
    this.children.push(child)
    this.fire('add-child', { child, node: this })
    this.fire('set-children', { node: this, children: this.children })
  }

  deleteChild(child: LoopNode) {
    if (!this.children.length) { return }

    const indexOf = this.children.indexOf(child)
    if (indexOf < 0) { return }

    this.children.splice(indexOf, 1)
    this.fire('delete-child', { child, node: this })
    this.fire('set-children', { node: this, children: this.children })
  }

  getSelectedNode() {
    return this.children[this.selectedNode]
  }

  addNode() {
    /* command the session to add a new node as a child for this node */
    this.session?.addNode({ parentUid: this.uid })
  }

}

export default LoopNode
