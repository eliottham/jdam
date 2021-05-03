import Evt from './evt'
import LoopNode from './loop_node'
import Settings from './settings'
import JdamClient from './jdam_client'

export interface SessionSettingsParams {
  setting1: string
}

type GenericResponse = { [index: string]: any }

class SessionSettings extends Settings {
}

class Sound {
  uid = ''
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

  info = {} as SessionInfo 

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

    this.getInfo()
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

  async getInfo() {
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
    }
  }

  async addNode({ parentUid }: { parentUid: string | null }) {
    const response = await this.client.wsSend('jam', JSON.stringify({
      token: this.client.authToken,
      sessionId: this.sessionId,
      req: {
        addNode: parentUid
      }
    }), true)

    const { data } = response
    if (data) {
      const rjson = JSON.parse(data)
      const { addedNode, error } = rjson
      if (error) {
        this.fire('add-node', { errors: [ error ] })
        this.fire('errors', { errors: [ error ] })
        return
      }
      const newNode = new LoopNode({ 
        uid: addedNode.uid,
        session: this 
      })
      if (parentUid) {
        const { node: parentNode } = this.findNode(parentUid)
        if (parentNode) {
          newNode.inheritFrom(parentNode)
          parentNode.addChild(newNode)
        }
        this.fire('add-node', { addedNode: newNode, parentNode })
        this.fire('set-nodes', { root: this.rootNode })
      }
      return newNode
    }
  }

  async deleteNode({ uid }: { uid: string }) {
    const response = await this.client.wsSend('jam', JSON.stringify({
      token: this.client.authToken,
      sessionId: this.sessionId,
      req: {
        deleteNode: uid
      }
    }))
    const { data } = response
    if (data) {
      const rjson = JSON.parse(data)
      const { deletedNode, error } = rjson
      if (error) {
        this.fire('delete-node', { errors: [ error ] })
        this.fire('errors', { errors: [ error ] })
        return
      }
      /* 
       * find the local version of the node.
       * remove from children of correct parent
       */
      const targetNode = this.findNode(deletedNode.uid).node
      if (targetNode) {
        targetNode.parent?.deleteChild(targetNode)
      }
      this.fire('delete-node', { deletedNode: targetNode })
      this.fire('set-nodes', { root: this.rootNode })
    }
  }

  async setNodes() {
    const response = await this.client.wsSend('jam', JSON.stringify({ 
      token: this.client.authToken,
      sessionId: this.sessionId,
      req: 'nodes' 
    }), true)
    const { data } = response
    if (data) {
      const rjson = JSON.parse(data)
      const rootTemplate = rjson.root
      const recurse = (nodeTemplate: GenericResponse, parent?: LoopNode): LoopNode => {
        const result = new LoopNode({
          session: this,
          uid: nodeTemplate.uid,
          parent
        })
        result.setChildren(nodeTemplate.children?.map((childTemplate: GenericResponse) => recurse(childTemplate, result)))
        return result
      }
      const newRoot = recurse(rootTemplate)
      this.rootNode.setChildren(newRoot.children)
      this.fire('set-nodes', { root: this.rootNode })
      return this.rootNode
    }
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
    }
  }

}

export default Session
