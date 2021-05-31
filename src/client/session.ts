import Evt from './evt'
import LoopNode from './loop_node'
import Settings from './settings'
import JdamClient from './jdam_client'
import UID from './uid'

export interface SessionSettingsParams {
  setting1: string
}

type GenericResponse = { [index: string]: any }

class SessionSettings extends Settings {
}

export interface SoundParams {
  uid?: string
  name?: string
  volume?: number
  pan?: number
  ownerNode?: LoopNode
  file?: File
  stops?: number[]
  accountId?: string
  muted?: boolean
  soloed?: boolean
  fromParent?: boolean
}

export class Sound {
  uid = ''
  name = ''
  volume = 1
  pan = 0
  muted = false
  soloed = false
  fromParent = false
  accountId?: string
  ownerNode?: LoopNode
  /* the sound file */
  file?: File

  /* 
   * milliseconds in to the sound clip with define:
   * [0]: start extent, -inf db
   * [1]: loop start, 0 db
   * [2]: loop end, 0 db
   * [3]: end extent, -inf db
   */
  stops: number[] = []

  constructor(params: SoundParams) {
    Object.assign(this, params)
  }
}

interface SessionParams {
  sessionId: string
  title: string
  sessionLength?: number
  description?: string
  rootNode?: LoopNode
  accounts?: string[]
  settings?: SessionSettingsParams
  client: JdamClient
}

interface SessionInfo {
  containerId: string
  title: string
  description: string
  sessionLength: number
  start: number
  end: number 
  duration: number 
  maxDepth: number 
  maxWidth: number 
}

/* 
 * this class will act as its own client and connect directly
 * to an active container running the session server software
 */
class Session extends Evt {
  rootNode = new LoopNode({ uid: 'root-node', session: this })

  info = {
    maxWidth: 4,
    maxDepth: 4
  } as SessionInfo 

  sessionId = ''
  title = ''
  description = ''
  color = '' /* hex value */
  accounts: Set<string> = new Set()
  start = 0
  sessionLength = 0
  settings = new SessionSettings()
  client: JdamClient
  sounds: Map<string, Sound> = new Map()
  _editingSound?: Sound

  constructor(params: SessionParams) {
    super()
    const { 
      sessionId,
      title,
      description,
      sessionLength,
      accounts = [],
      settings = {},
      client
    } = params
    Object.assign(this, {
      sessionId,
      title,
      description,
      sessionLength
    })

    this.client = client

    this.setAccounts(accounts)

    if (!params.sessionId) { throw Error('session id is required') }

    this.setInfo()
  }

  setActive() {
    this.client.setActiveSession(this.sessionId)
  }

  setAccounts(accounts: string[] = []) {
    if (!accounts.length) {
      this.accounts.clear() 
      return
    } 

    for (const account of accounts) {
      this.accounts.add(account)
    }
  }

  getAccounts() {
    return Array.from(this.accounts)
  }

  findNode(uid: string): { node?: LoopNode, depth?: number } { 
    const recurse = (node: LoopNode, depth: number): { node?: LoopNode, depth?: number } => {
      if (node.uid === uid) { return { node, depth } }
      else { 
        for (const child of node.children) {
          const result = recurse(child, depth + 1)
          if (result.node) { return result }
        }
      }
      return {}
    }

    return recurse(this.rootNode, 0)
  }

  async setInfo() {
    const response = await this.client.wsSend('jam', JSON.stringify({ 
      token: this.client.authToken,
      sessionId: this.sessionId,
      req: 'info'
    }), true)

    const { data } = response
    if (data) {
      const rjson = JSON.parse(data)
      const { info } = rjson
      if (info) { Object.assign(this.info, info) }
      this.fire('set-info', { info: this.info })
    }
  }

  addNode({ parentUid }: { parentUid: string | null }) {
    this.client.wsSend('jam', JSON.stringify({
      token: this.client.authToken,
      sessionId: this.sessionId,
      req: {
        addNode: parentUid
      }
    }))
  }

  async deleteNode({ uid }: { uid: string }) {
    this.client.wsSend('jam', JSON.stringify({
      token: this.client.authToken,
      sessionId: this.sessionId,
      req: {
        deleteNode: uid
      }
    }))
  }

  async setNodes() {
    this.client.wsSend('jam', JSON.stringify({ 
      token: this.client.authToken,
      sessionId: this.sessionId,
      req: 'nodes' 
    }))
  }

  handleResponse(params: GenericResponse) {
    /* TODO: all of the possible responses */
    if (params.info) {
      const { title, description, accounts = [] } = params.info  
      Object.assign(this, { title, description })
      this.setAccounts(accounts)
      this.fire('set-accounts', { accounts: this.getAccounts() })
    } else if (params.addAccount) {
      this.accounts.add(params.addAccount)
      this.fire('set-accounts', { accounts: this.getAccounts() })
    } else if (params.root) {
      const rootTemplate = params.root
      const recurse = (nodeTemplate: GenericResponse, parent?: LoopNode): LoopNode => {
        const result = new LoopNode({
          session: this,
          uid: nodeTemplate.uid,
          sounds: nodeTemplate.sounds,
          parent
        })
        result.setChildren(nodeTemplate.children?.map((childTemplate: GenericResponse) => recurse(childTemplate, result)))
        return result
      }
      const newRoot = recurse(rootTemplate)
      this.rootNode.setChildren(newRoot.children)
      this.fire('set-nodes', { root: this.rootNode })
    } else if (params.addedNode) {
      const { addedNode } = params
      const newNode = new LoopNode({ 
        uid: addedNode.uid,
        session: this 
      })
      if (addedNode.parentUid) {
        const { node: parentNode } = this.findNode(addedNode.parentUid)
        if (parentNode) {
          newNode.inheritFrom(parentNode)
          parentNode.addChild(newNode)
          parentNode.setSelectedNode(parentNode.children.indexOf(newNode))
        }
        this.fire('add-node', { addedNode: newNode, parentNode })
        this.fire('set-nodes', { root: this.rootNode })
      }
      return newNode
    } else if (params.deletedNode) {
      const { deletedNode } = params
      /* 
       * find the local version of the node.
       * remove from children of correct parent
       */
      const { node: targetNode } = this.findNode(deletedNode.uid)
      if (targetNode) {
        targetNode.parent?.deleteChild(targetNode)
      }
      this.fire('delete-node', { deletedNode: targetNode })
      this.fire('set-nodes', { root: this.rootNode })
    } else if (params.addedSound || params.updatedSound) {
      const soundParams = (params.addedSound || params.updatedSound) as SoundParams

      const { 
        accountId,
        ownerNode,
        uid,
        name, 
        volume = 1,
        pan = 0, 
        stops = []
      } = soundParams

      if (!uid) { return }

      const existingSound = this.sounds.get(uid)

      if (existingSound) {
        Object.assign(existingSound, params)
        this.fire('update-sound', { sound: existingSound })
      } else {
        const newSoundData = { 
          accountId,
          uid,
          name: name || uid.slice(0, 12),
          volume,
          pan,
          stops
        } 

        const sound = new Sound(newSoundData)
        this.sounds.set(uid, sound)

        if (ownerNode?.uid) {
          this.assignSoundToNode({ nodeUid: ownerNode.uid, soundUid: uid })
        }

        this.fire('insert-sound', { sound })
      }
    } else if (params.assignedSound && params.toNode) {
      /* this should really never be called */
      const { assignedSound, toNode } = params
      const { node: targetNode } = this.findNode(toNode.uid)
      const sound = this.sounds.get(assignedSound.uid)
      if (sound && targetNode) {
        sound.ownerNode = targetNode
        this.fire('assign-sound', { assignedSound: sound, toNode: targetNode })
      }
    } else if (params.uploadedSoundFile) {
      const { uploadedSoundFile: uid } = params
      const existingSound = this.sounds.get(uid)
      if (existingSound) {
        this.downloadSoundFile(uid)
      }
    } else if (params.deletedSound) {
      const { deletedSound } = params
      if (this.sounds.has(deletedSound)) {
        this.sounds.delete(deletedSound)
        this.fire('delete-sound', { uid: deletedSound })
      }
    } else if (params.error) {
      this.fire('errors', { errors: [ params.error ] })
    }
  }

  getSound(uid: string) {
    return this.sounds.get(uid)
  }

  assignSoundToNode({ soundUid, nodeUid }: { soundUid: string, nodeUid: string }) {
    this.client.wsSend('jam', JSON.stringify({
      token: this.client.authToken,
      sessionId: this.sessionId,
      req: {
        assignSound: soundUid,
        toNode: nodeUid
      }
    }))
  }

  upsertSound(sound: Sound) {
    this.client.wsSend('jam', JSON.stringify({
      token: this.client.authToken,
      sessionId: this.sessionId,
      req: {
        upsertSound: {
          uid: sound.uid,
          name: sound.name,
          volume: sound.volume,
          pan: sound.pan,
          accountId: sound.accountId,
          ownerNode: sound.ownerNode?.uid,
          stops: sound.stops
        }
      }
    }))
  }

  deleteSound(uid: string) {
    this.client.wsSend('jam', JSON.stringify({
      token: this.client.authToken,
      sessionId: this.sessionId,
      req: { uid }
    }))
  }

  async uploadSoundFile(file: File, uid: string) {
    const response = await fetch(`sessions/${this.sessionId}/stream/upload?uid=${uid}`, {
      method: 'POST',
      headers: {
        'Content-Type': file.type
      },
      body: file 
    })
    const responseJson = await response.json()
    const { errors } = responseJson
    if (errors) {
      this.fire('upload-sound-file', { errors })
      return
    }

    this.fire('upload-sound-file', { uid, file })
  }

  async downloadSoundFile(uid: string) {
    const response = await fetch(`sessions/${this.sessionId}/stream/download/${uid}`, {
      method: 'GET'
    })

    const contentType = response.headers.get('Content-Type')
    if (!contentType) {
      this.fire('download-sound-file', { errors: [ 'no content type / file not found' ] })
      return
    }

    const fileType = contentType?.split(';')[0].split('/')[1]

    const blob = await response.blob()

    const file = new File([ blob ], `${uid}.${fileType}`, {
      type: contentType
    })

    this.fire('download-sound-file', { file })

    const sound = this.sounds.get(uid)
    if (sound) {
      this.assignFileToSound({ file, sound })
    }
  }

  editSound({ node, sound = this._editingSound }: { node?: LoopNode, sound?: Sound}) {
    if (!sound) {
      sound = new Sound({
        uid: UID.hex(24),
        name: `New Sound ${this.sounds.size}`,
        volume: 1,
        pan: 0,
        ownerNode: node,
        stops: [],
        accountId: this.client.accountId
      })
    }
    this._editingSound = sound
    this.fire('edit-sound', { sound }) 
  }

  cancelEditSound() {
    const sound = this._editingSound
    this._editingSound = undefined
    this.fire('cancel-edit-sound', { sound }) 
  }

  assignFileToSound({ file, sound }: { file: File, sound: Sound }) {
    sound.file = file
    this.fire('set-sound-file', { sound, file })
  }

}

export default Session
