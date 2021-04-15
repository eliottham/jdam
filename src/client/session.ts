import Evt from './evt'
import LoopNode from './loop_node'
import Settings from './settings'

class SessionSettings extends Settings {
}

interface SessionParams {
  sessionId: string
  webSocket?: WebSocket
  nodes?: LoopNode[]
}

interface ResponseData {
  connectedAccounts?: string[]
}

/* 
 * this class will act as its own client and connect directly
 * to an active container running the session server software
 */
class Session extends Evt {
  nodes: LoopNode[] = []
  sessionId = ''
  authToken = ''
  title = ''
  description = ''
  color = '' /* hex value */
  userCount = 0
  settings = new SessionSettings()

  constructor(params: SessionParams) {
    super()
    Object.assign(this, {}, params)

    if (!params.sessionId) { throw Error('session id is required') }
  }

  handleResponse(params: ResponseData) {
    /* TODO: all of the possible responses */
  }

}

export default Session
