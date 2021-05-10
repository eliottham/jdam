import Evt from './evt'
import Session from './session'
import Settings from './settings'

class ClientSettings extends Settings {
  inputs: MediaDeviceInfo[] = []
  outputs: MediaDeviceInfo[] = []
  muted = false
  deafened = false
  vidMuted = false
  _gotMediaDevices = false

  async enumerateAudioDevices() {
    await navigator.mediaDevices.getUserMedia({audio: true, video: true})
    this._gotMediaDevices = true
    const devices = await navigator.mediaDevices.enumerateDevices()
    const inputs = []
    const outputs = []
    for (const device of devices) {
      if (device.kind === 'audioinput') { inputs.push(device) }
      else if (device.kind === 'audiooutput') { outputs.push(device) }
    }

    this.inputs.splice(0, this.inputs.length)
    Array.prototype.push.apply(this.inputs, inputs)

    this.outputs.splice(0, this.outputs.length)
    Array.prototype.push.apply(this.outputs, outputs)

    this.fire('enum-audio-devices', { inputs, outputs })
  }

  setSoundSettings(params: {
    muted?: boolean
    deafened?: boolean
    vidMuted?: boolean
  }) {
    if ('muted' in params) {
      this.muted = !!params.muted
    }
    if ('deafened' in params) {
      this.deafened = !!params.deafened
    }
    if ('vidMuted' in params) {
      this.vidMuted = !!params.vidMuted
    }
    this.fire('set-sound-settings', { 
      muted: this.muted,
      deafened: this.deafened,
      vidMuted: this.vidMuted
    })
  }

  setMuted(muted: boolean) {
    this.setSoundSettings({ muted })
  }

  setDeafened(deafened: boolean) {
    this.setSoundSettings({ deafened })
  }

  setVidMuted(vidMuted: boolean) {
    this.setSoundSettings({ vidMuted })
  }

  toggleMuted() {
    this.setSoundSettings({ muted: !this.muted })
  }

  toggleDeafened() {
    this.setSoundSettings({ deafened: !this.deafened })
  }

  toggleVidMuted() {
    this.setSoundSettings({ vidMuted: !this.vidMuted })
  }
}

interface JdamClientParams {
  username: string,
  hash: string 
}

class JdamClient extends Evt {
  _mId = Math.ceil(Math.random() * Date.now())
  _pendingMessages: Map<number, (params: { prefix: string, mId: string, data: string }) => void> = new Map()
  username = ''
  nickname = ''
  hash = ''
  authToken = ''
  accountId = ''
  webSocket?: WebSocket
  sessions: Map<string, Session> = new Map()
  activeSession = ''
  settings = new ClientSettings()

  constructor(params?: JdamClientParams) {
    super()
    Object.assign(this, {}, params)
    this.settings.enumerateAudioDevices()
  }

  isWsConnected(): boolean {
    if (!this.webSocket) return false

    return this.webSocket.readyState === WebSocket.OPEN
  }

  wsSend(prefix: string, message: string, withMId = false): Promise<{ prefix: string, mId: string, data: string }> {
    return new Promise(resolve => {
      if (this.isWsConnected()) {
        this._mId++
        const mId = this._mId
        this.webSocket?.send(`${prefix}:${mId}:${message}`)
        if (withMId) {
          this._pendingMessages.set(mId, resolve)
          /* 
           * clear the message out after 5 seconds - it doesn't matter if the
           * message is actually there or not, the map can handle a delete on a
           * key that isn't found.
           */
          setTimeout(() => {
            this._pendingMessages.delete(mId)
          }, 5000)
        }
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
          const pendingMessage = this._pendingMessages.get(Number(mId))
          if (pendingMessage) {
            this._pendingMessages.delete(Number(mId))
            pendingMessage({
              prefix,
              mId,
              data
            })
            return
          }
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
                this.setActiveSession()
              }
            } catch (err) {
              /* do nothing */
            }
            break
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

  async accountInfo() {
    if (!this.accountId || !this.authToken) return {}
    try {
      const responseJson = await (await fetch('account', { method: 'GET'})).json()
      const { success, account } = responseJson
      if (success) {
        this.username = account.email
        this.hash = account.hash
        this.nickname = account.nickname
        if (account.sessions.length) {
          for (const session of account.sessions) {
            const { _id: sessionId, title, description, accounts } = session
            this.sessions.set(sessionId, new Session({ 
              title,
              description,
              sessionId,
              accounts,
              client: this
            }))
          }
          this.fire('set-sessions', { sessions: this.getSessions() })
        }
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

  setActiveSession(sessionId = '') {
    if (!sessionId) {
      this.fire('active-session', { sessionId: '', session: undefined })
      this.activeSession = ''
      return
    }

    const session = this.sessions.get(sessionId)
    if (!session) return

    this.activeSession = sessionId
    this.fire('active-session', { sessionId, session })

    session.setNodes()
  }

  
}

export default JdamClient
