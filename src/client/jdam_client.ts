import Evt from './evt'
import Session from './session'
import Settings from './settings'
import base64Valid from 'base-64-valid'

class ClientSettings extends Settings {
}

interface JdamClientParams {
  username: string,
  hash: string 
}

class JdamClient extends Evt {
  username = ''
  nickname = ''
  hash = ''
  authToken = ''
  accountId = ''
  webSocket: WebSocket | undefined
  sessions: Map<string, Session> = new Map()
  activeSession = ''
  settings = new ClientSettings()

  constructor(params?: JdamClientParams) {
    super()
    Object.assign(this, {}, params)
  }

  isWsConnected(): boolean {
    if (!this.webSocket) return false

    return this.webSocket.readyState === WebSocket.OPEN
  }

  wsSend(prefix: string, message: string): void {
    if (this.isWsConnected()) {
      this.webSocket?.send(`${prefix}:${message}`)
    }
  }

  connect(retryOnly = false) {
    if (this.isWsConnected() && retryOnly) {
      return 
    }

    return new Promise<void>((resolve, reject) => {
      if (this.webSocket) {
        this.webSocket.close()
      }

      this.webSocket = new WebSocket(`ws://${location.host}`)
      this.webSocket.addEventListener('error', () => {
        const message = 'Real-time connection to serverino encountered an error'
        reject(Error(message))
      })
      this.webSocket.addEventListener('message', async evt => {
        if (evt.data === 'connected') {
          if (this.isWsConnected()) {
            resolve()
          }
        } else if (typeof evt.data === 'string') {
          const prefix = evt.data.split(':')[0]
          const data = evt.data.slice(prefix.length + 1)
          switch (prefix) {
          case 'ses':
            try {
              const rjson  = JSON.parse(data)
              const { expired, loggedOff } = rjson
              if (expired === true || loggedOff === true) {
                this.fire('logoff', rjson)
              }
            } catch (err) {
              /* do nothing */
            }
          }
        }
      })
    })
  }

  async checkAccountAvailable(email: string): Promise<{ success: boolean, errors?: string[] }> {
    try {
      const response = await fetch('account/available', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email })
      })
      const responseJson = await response.json()
      this.fire('check-account-available', responseJson)
      return (responseJson)
    } catch (err) {
      /* do nothing */
    }
    return { success: false }
  }

  async createAccount(params: { email: string, password: string, nickname?: string} ) {

    const encoder = new TextEncoder()
    const { email, password } = params

    let hash = ''
    const hashBuffer = new Uint8Array(await crypto.subtle.digest('sha-256', encoder.encode(`${email}${password}`)))
    if (email && password) hash = btoa(hashBuffer.reduce((data, code) => data + String.fromCharCode(code), ''))

    try {
      const response = await fetch('account', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, hash, nickname: params.nickname })
      })
      const responseJson = await response.json()
      this.fire('create-account', responseJson)
    } catch (err) {
      /* do nothing */
    }
  }

  async accountInfo() {
    if (!this.accountId || !this.authToken) return {}
    try {
      const responseJson = await (await fetch('account', { method: 'GET'})).json()
      const { success, account } = responseJson
      if (success) {
        this.username = account.email
        this.hash = account.hash
        this.nickname = account.nickname
        this.fire('account-info', { username: this.username, nickname: this.nickname })
      }
    } catch (err) {
      /* do nothing */
    }
  }

  async logon(email?: string, password?: string, suppressErrors?: boolean) {

    const encoder = new TextEncoder()

    let hash = ''
    const hashBuffer = new Uint8Array(await crypto.subtle.digest('sha-256', encoder.encode(`${email}${password}`)))
    if (email && password) hash = btoa(hashBuffer.reduce((data, code) => data + String.fromCharCode(code), ''))

    try {
      const response = await fetch('auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, hash })
      })
      const responseJson = await response.json()
      this.authToken = responseJson.token
      this.accountId = responseJson.id
      if (suppressErrors) delete responseJson.errors
      this.fire('logon', responseJson)
      if (responseJson.success) {
        await this.connect()
        this.wsSend('tok', this.authToken)
        this.accountInfo()
      }
    } catch (err) {
      /* do nothing */
    }
  }

  async logoff() {
    const response = await fetch('unauth', {
      method: 'GET'
    })
    const responseJson = await response.json()
    this.fire('logoff', responseJson)
  }

  getSessions(): Session[] {
    return Array.from(this.sessions.values())
  }

  setActiveSession(uuid: string) {
    const session = this.sessions.get(uuid)
    if (!session) return

    this.activeSession = uuid
    this.fire('active-session', { uuid, session })
  }
  
}

export default JdamClient
