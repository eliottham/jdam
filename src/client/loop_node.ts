import Evt from './evt'
import Session, { Sound, SoundParams } from './session'

interface LoopNodeParams {
  children?: LoopNode[]
  parent?: LoopNode
  session?: Session
  sounds?: string[]
  uid: string
}

class LoopNode extends Evt {
  children: LoopNode[] = []
  selectedNode = 0 /* index in children array */
  parent: LoopNode | undefined
  sounds: Set<string> = new Set() /* references to uid only, sounds will be stored on session in a map */
  uid = ''
  session?: Session

  constructor({ children, parent, uid, session, sounds }: LoopNodeParams) {
    super()

    if (children) { this.children = children }
    if (parent) { this.inheritFrom(parent) }
    if (session) { this.session = session }
    if (sounds) {
      for (const sound of sounds) {
        this.sounds.add(sound)
      }
    }
    this.uid = uid
  }

  getSound(uid: string) {
    return this.session?.getSound(uid)
  }

  getSounds(): Sound[] {
    if (!this.parent) { return [] }

    const parentSounds = this.parent.getSounds()
    const sounds = [] 
    for (const soundUid of this.sounds) {
      const sound = this.getSound(soundUid)
      if (sound) { sounds.push(sound) }
    }

    return parentSounds.concat(sounds)
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

  editSound() {
    this.session?.editSound({ node: this })
  }

  downloadSoundFile(uid: string) {
    this.session?.downloadSoundFile(uid)
  }

  assignSound(soundUid: string) {
    this.session?.assignSoundToNode({ soundUid, nodeUid: this.uid })
  }

}

export default LoopNode
