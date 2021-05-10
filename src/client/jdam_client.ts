import Evt from './evt'
import Session from './session'
import Settings from './settings'

class ClientSettings extends Settings {
}

interface JdamClientParams {
  username: string,
  hash: string 
}

class JdamClient extends Evt {
  _mId = 0
  _pendingMessages: Map<number, (params: { prefix: string, mId: string, data: string }) => void> = new Map()
  email = ''
  nickname = ''
  hash = ''
  avatarId = ''
  authToken = ''
  accountId = ''
  webSocket?: WebSocket
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

  wsSend(prefix: string, message: string): Promise<{ prefix: string, mId: string, data: string }> {
    return new Promise(resolve => {
      if (this.isWsConnected()) {
        this._mId++
        this.webSocket?.send(`${prefix}:${this._mId}:${message}`)
        this._pendingMessages.set(this._mId, resolve)
      }
    })
  }

  connect(retryOnly = false) {
    if (this.isWsConnected() && retryOnly) {
      return 
    }

    return new Promise<void>((resolve, reject) => {
      if (this.webSocket) {
        this.webSocket.close()
      }

      this.webSocket = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`)
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
          const [ prefix, mId ] = evt.data.split(':').slice(0, 2)
          const data = evt.data.slice(prefix.length + mId.length + 2)
          switch (prefix) {
          case 'ses':
            try {
              const rjson = JSON.parse(data)
              const { expired, loggedOff } = rjson
              if (expired === true || loggedOff === true) {
                this.fire('logoff', rjson)
              }
            } catch (err) {
              /* do nothing */
            }
            break
          case 'jam':
            try {
              const rjson = JSON.parse(data)
              const { sessionId, endSession, purgeSessions } = rjson
              const session = this.sessions.get(sessionId)
              if (session) {
                if (!endSession) {
                  session.handleResponse(rjson)
                  return
                }
                this.sessions.delete(sessionId)
                this.fire('delete-session', { sessionId, session })
                this.fire('set-sessions', { sessions: this.getSessions() })
              } else if (purgeSessions) {
                this.sessions.clear()
                this.fire('purge-sessions', {})
                this.fire('set-sessions', { sessions: this.getSessions() })
              }
            } catch (err) {
              /* do nothing */
            }
            break
          }
          const pendingMessage = this._pendingMessages.get(Number(mId))
          if (pendingMessage) {
            this._pendingMessages.delete(Number(mId))
            pendingMessage({
              prefix,
              mId,
              data
            })
          }
        }
      })
    })
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

  async updateAccountSettings({ email, nickname, currentPassword, newPassword }: { email?: string, nickname?: string, currentPassword?: string, newPassword?: string }) {
    const encoder = new TextEncoder()
    let currentHash = ''
    let newHash = ''  
    let hashBuffer = new Uint8Array(await crypto.subtle.digest('sha-256', encoder.encode(`${this.email}${currentPassword}`)))
    if (this.email && currentPassword) currentHash = btoa(hashBuffer.reduce((data, code) => data + String.fromCharCode(code), ''))    
    hashBuffer = new Uint8Array(await crypto.subtle.digest('sha-256', encoder.encode(`${email}${newPassword || currentPassword}`)))
    if (email && (newPassword || currentPassword)) newHash = btoa(hashBuffer.reduce((data, code) => data + String.fromCharCode(code), ''))
    
    try {
      const response = await fetch('account/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, nickname, currentHash, newHash })
      })
      const responseJson = await response.json()
      this.fire('update-account-settings', responseJson)
    } catch (err) {
      /* do nothing */
    }
  }

  async accountInfo() {
    if (!this.accountId || !this.authToken) return {}
    try {
      const response = await fetch('account', { method: 'GET'})
      const responseJson = await response.json()
      const { success, account } = responseJson
      if (success) {
        this.email = account.email
        this.hash = account.hash
        this.nickname = account.nickname
        this.avatarId = account.avatarId
        if (account.sessions.length) {
          for (const session of account.sessions) {
            const { _id: sessionId, title, description, accounts } = session
            this.sessions.set(sessionId, new Session({ 
              title,
              description,
              sessionId,
              accounts,
              webSocket: this.webSocket,
              client: this
            }))
          }
          this.fire('set-sessions', { sessions: this.getSessions() })
        }
        this.fire('account-info', { 
          email: this.email,
          nickname: this.nickname,
          avatarId: this.avatarId 
        })
      }
    } catch (err) {
      /* do nothing */
    }
  }

  async uploadAvatar(data: FormData) {
    const response = await fetch('account/avatar', 
      { 
        method: 'POST',
        body: data
      })
    const { avatarId, errors = [] } = await response.json()
    this.fire('set-avatar-id', { errors })
    this.avatarId = avatarId
    this.fire('account-info', { 
      email: this.email,
      nickname: this.nickname,
      avatarId: this.avatarId 
    })
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

  async createSession({
    title,
    description,
    sessionLength = 1 
  }: { 
    title: string,
    description?: string,
    sessionLength?: number 
  }) {
    try {
      const response = await fetch('session/create', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ title, description, sessionLength })
      })
      const responseJson = await response.json()
      const { sessionId, success, errors = [] } = responseJson
      if (!success) {
        this.fire('create-session', { success, errors })
        return
      }
      const newSession = new Session({ 
        title,
        description,
        sessionLength,
        sessionId,
        webSocket: this.webSocket,
        client: this
      })
      this.sessions.set(sessionId, newSession)
      this.fire('create-session', { sessionId, newSession })
      this.fire('set-sessions', { sessions: this.getSessions() })
      this.setActiveSession(sessionId)
    } catch (err) {
      /* do nothing */
    }
  }

  async joinSession({ sessionId }: { sessionId: string }) {
    try {
      const response = await fetch('session/join', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ sessionId })
      })
      const responseJson = await response.json()
      const { success, errors = [], title, description } = responseJson
      if (!success) {
        this.fire('create-session', { success, errors: [ 'Could not join session' ].concat(errors) })
        return
      }
      const newSession = new Session({ 
        title,
        description,
        sessionId,
        webSocket: this.webSocket,
        client: this
      })
      this.sessions.set(sessionId, newSession)
      this.fire('create-session', { sessionId, newSession })
      this.fire('set-sessions', { sessions: this.getSessions() })
    } catch (err) {
      /* do nothing */
    }
  }

  getSessions(): Session[] {
    return Array.from(this.sessions.values())
  }

  setActiveSession(sessionId: string) {
    const session = this.sessions.get(sessionId)
    if (!session) return

    this.activeSession = sessionId
    this.fire('active-session', { sessionId, session })
  }
  
}

export default JdamClient
