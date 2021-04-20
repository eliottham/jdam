import Evt from './evt'
import LoopNode from './loop_node'
import Settings from './settings'
import JdamClient from './jdam_client'

export interface SessionSettingsParams {
  setting1: string
}

class SessionSettings extends Settings {
}

interface SessionParams {
  sessionId: string
  title: string
  sessionLength?: number
  description?: string
  webSocket?: WebSocket
  nodes?: LoopNode[]
  accounts?: string[]
  settings?: SessionSettingsParams
  client: JdamClient
}

/* 
 * this class will act as its own client and connect directly
 * to an active container running the session server software
 */
class Session extends Evt {
  nodes: LoopNode[] = []
  sessionId = ''
  title = ''
  description = ''
  color = '' /* hex value */
  accounts: Set<string> = new Set()
  start = 0
  sessionLength = 0
  settings = new SessionSettings()
  webSocket?: WebSocket
  client: JdamClient

  constructor(params: SessionParams) {
    super()
    const { 
      sessionId,
      title,
      description,
      sessionLength,
      accounts = [],
      settings = {},
      webSocket,
      client
    } = params
    Object.assign(this, {
      sessionId,
      title,
      description,
      sessionLength
    })

    this.webSocket = webSocket
    this.client = client

    this.setAccounts(accounts)

    if (!params.sessionId) { throw Error('session id is required') }
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

  handleResponse(params: { [index: string]: any }) {
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
