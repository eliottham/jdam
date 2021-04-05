import Evt from './evt'
import LoopNode from './loop_node'
import Settings from './settings'

class SessionSettings extends Settings {
}

interface SessionParams {
  nodes?: LoopNode[]
  uuid?: string
}

/* 
 * this class will act as its own client and connect directly
 * to an active container running the session server software
 */
class Session extends Evt {
  nodes: LoopNode[] = []
  uuid = ''
  authToken = ''
  title = ''
  description = ''
  color = '' /* hex value */
  userCount = 0
  webSocket: WebSocket | undefined
  settings = new SessionSettings()

  constructor(params: SessionParams) {
    super()
    Object.assign(this, {}, params)

    if (!this.uuid) {
      /* generate crypto-random uuid */
    }
  }
}

export default Session
