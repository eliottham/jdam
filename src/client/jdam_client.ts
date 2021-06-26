import Evt from './evt'
import Session from './session'
import Settings from './settings'
import Metro from './metro'

import Account from './account'

export type AudioDeviceType = 'input' | 'output'

class ClientSettings extends Settings {
  inputs: MediaDeviceInfo[] = []
  outputs: MediaDeviceInfo[] = []
  selectedInput = 'default'
  selectedOutput = 'default'
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

  getDevices({ type }: { type: AudioDeviceType }) {
    const devices = type === 'input' ? this.inputs : this.outputs
    const result = []
    let index = 0
    for (const device of devices) {
      result.push({
        kind: device.kind,
        deviceId: device.deviceId,
        groupId: device.groupId,
        label: device.label,
        index,
        selected: this.selectedInput === device.deviceId
      })
      index ++
    }
    return result
  }

  getDevice({ type, deviceId }: { type: AudioDeviceType, deviceId: string }) {
    const list = type === 'input' ? this.inputs : this.outputs
    return list.find(device => device.deviceId === deviceId)
  }

  getSelectedDevice({ type }: { type: AudioDeviceType }) {
    return this.getDevice({ type, deviceId: type === 'input' ? this.selectedInput : this.selectedOutput })
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

  setSelectedDevice({ type, deviceId }: { type: AudioDeviceType, deviceId: string }) {
    if (type === 'input') {
      this.selectedInput = deviceId
    } else {
      this.selectedOutput = deviceId
    }
    this.fire('set-selected-device', { type, deviceId })
  }
}

interface JdamClientParams {
  username: string,
  hash: string 
}

class JdamClient extends Evt {
  _mId = Math.ceil(Math.random() * Date.now())
  _pendingMessages: Map<number, (params: { prefix: string, mId: string, data: string }) => void> = new Map()
  authToken = ''
  webSocket?: WebSocket
  activeSession = ''
  settings = new ClientSettings()
  account = new Account({})
  metro = new Metro()
  audioCtx = new AudioContext({ sampleRate: 48000 })

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
              const { sessionId, endSession, purgeSessions, start } = rjson

              if (start) {
                const {
                  id: sessionId,
                  title,
                  description,
                  accounts
                } = start
                const newSession = new Session({ 
                  title,
                  description,
                  sessionId,
                  accounts,
                  client: this
                })
                this.account.sessions.set(sessionId, newSession)
                this.fire('set-sessions', { sessions: this.getSessions() })
                this.setActiveSession(sessionId)
                return
              }

              const session = this.account.sessions.get(sessionId)
              if (session) {
                if (!endSession) {
                  session.handleResponse(rjson)
                  return
                }
                this.account.sessions.delete(sessionId)
                this.fire('delete-session', { sessionId, session })
                this.fire('set-sessions', { sessions: this.getSessions() })
              } else if (purgeSessions) {
                this.account.sessions.clear()
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
      const response = await fetch('/account', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, hash, nickname: params.nickname })
      })
      const responseJson = await response.json()
      const { errors, account } = responseJson

      if (errors) {
	this.fire('create-account', { errors })
      }

      this.fire('create-account', account)

      /* TODO: fix this arguments trashe */
      this.logon(email, password)
    } catch (err) {
      /* do nothing */
    }
  }

  async findAccounts(query: string) {
    try {
      const response = await fetch('/accounts/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query })
      })
      const responseJson = await response.json()
      const accounts = []
      if (responseJson.success) {
        for (const account of responseJson.accounts) {
          delete account.hash
          account.id = account._id
          accounts.push(new Account(account))
        }
      }
      this.fire('search-accounts', accounts)
    } catch (err) {
      /* do nothing */
    }
  }

  async getFriendRequests() {
    try {
      const response = await fetch('/accounts/friend/request', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      })
      const responseJson = await response.json()
      console.log(responseJson)
    } catch (err) {
      /* do nothing */
    }
  }

  /* Send a friend request with the 'pending' flag set to true until the recipient confirms / denies */
  async sendFriendRequest(targetFriend: Account) {
    try {
      await fetch('/accounts/friend/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          id: targetFriend.id,
          nickname: targetFriend.nickname,
          pending: true,
          requested: new Date()
        })
      })
      this.accountInfo()
    } catch (err) {
      /* do nothing */
    }
  }

  async removeFriend(targetFriend: Account) {
    try {
      await fetch('/accounts/friend', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          id: targetFriend.id,
          nickname: targetFriend.nickname
        })
      })
      this.accountInfo()
    } catch (err) {
      /* do nothing */
    }
  }

  async updateAccountSettings({ 
    email,
    nickname,
    currentPassword,
    newPassword 
  }: { 
    email?: string,
    nickname?: string,
    currentPassword?: string,
    newPassword?: string 
  }) {
    const encoder = new TextEncoder()
    let currentHash = ''
    let newHash = ''  
    let hashBuffer = new Uint8Array(await crypto.subtle.digest('sha-256', encoder.encode(`${this.account.email}${currentPassword}`)))

    if (this.account.email && currentPassword) {
      currentHash = btoa(hashBuffer.reduce((data, code) => data + String.fromCharCode(code), ''))    
    }

    hashBuffer = new Uint8Array(await crypto.subtle.digest('sha-256', encoder.encode(`${email}${newPassword || currentPassword}`)))

    if (email && (newPassword || currentPassword)) {
      newHash = btoa(hashBuffer.reduce((data, code) => data + String.fromCharCode(code), ''))
    }
    
    try {
      const response = await fetch('/account/settings', {
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

  getSessionFromUrl() {
    const { pathname } = window.location
    if (!pathname) { return }

    const testRegex = /\/sessions\/([A-Fa-f0-9]{12})/
    if (!testRegex.test(pathname)) { return }

    return testRegex.exec(pathname)?.[1]?.toLowerCase()
  }

  async accountInfo() {
    if (!this.account.id ) { return {} }
    try {
      const response = await fetch('/account', { method: 'GET'})
      const responseJson = await response.json()
      const { success, account } = responseJson
      if (success) {
        account.id = account._id
        this.account = new Account(account)
        if (account.sessions.length) {
          for (const session of account.sessions) {
            const { _id: sessionId, title, description, accounts } = session

            /* don't overwrite existing sessions */
            if (this.account.sessions.has(sessionId)) { continue }

            this.account.sessions.set(sessionId, new Session({ 
              title,
              description,
              sessionId,
              accounts,
              client: this
            }))
          }
          this.fire('set-sessions', { sessions: this.getSessions() })
          /* after loading sessions, check whether the url is in the list */

        }

        this.fire('account-info', {
          account: this.account
        })

        const urlSessionId = this.getSessionFromUrl()
        if (urlSessionId && !this.account.sessions.has(urlSessionId)) {
          const sessions = await this.findSessions({ sessionId: urlSessionId })
          if (sessions.length) {
            this.fire('prompt-join-session-url', { sessionId: urlSessionId })
          }
        }
      }
    } catch (err) {
      /* do nothing */
    }
  }

  async uploadAvatar(file: File) {
    if (!this.account) { return }
    const response = await fetch('/account/avatar', { 
      method: 'POST',
      headers: {
        'Content-Type': file.type
      },        
      body: file
    })
    const { avatarId, errors = [] } = await response.json()
    this.fire('set-avatar-id', { errors })
    this.account.avatarId = avatarId
    this.fire('account-info', {
      account: this.account
    })
  }

  async logon(email?: string, password?: string, suppressErrors?: boolean, hash = '') {

    if (!hash) {
      const encoder = new TextEncoder()
      const hashBuffer = new Uint8Array(await crypto.subtle.digest('sha-256', encoder.encode(`${email}${password}`)))

      if (email && password) { 
	hash = btoa(hashBuffer.reduce((data, code) => data + String.fromCharCode(code), '')) 
      }
    }

    try {
      const response = await fetch('/auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, hash })
      })
      const responseJson = await response.json()
      this.authToken = responseJson.token
      this.account.id = responseJson.id
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

  bounce() {
    fetch('/bounce', { method: 'GET' })
  }

  async logoff() {
    const response = await fetch('/unauth', {
      method: 'GET'
    })
    const responseJson = await response.json()
    this.fire('logoff', responseJson)
  }

  async createSession({
    title,
    description,
    sessionLength = 1,
    bpm = 120,
    measures = 4,
    pattern = [ 2, 1, 1, 1 ]
  }: { 
    title: string,
    description?: string,
    sessionLength?: number,
    bpm?: number,
    measures?: number,
    pattern?: number[]
  }) {
    try {
      const response = await fetch('/session/create', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          title,
          description,
          sessionLength,
          bpm,
          measures,
          pattern
        })
      })
      const responseJson = await response.json()
      const { sessionId, success, errors = [] } = responseJson
      if (!success) {
        this.fire('create-session', { success, errors })
        return
      }
      this.fire('create-session', { sessionId })
    } catch (err) {
      /* do nothing */
    }
  }

  async joinSession({ sessionId }: { sessionId: string }) {
    try {
      const response = await fetch('/session/join', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ sessionId })
      })
      const responseJson = await response.json()
      const { success, errors = [], title, description, accounts } = responseJson
      if (!success) {
        this.fire('join-session', { success, errors: [ 'Could not join session' ].concat(errors) })
        return
      }
      const newSession = new Session({ 
        title,
        description,
        sessionId,
        accounts,
        client: this
      })
      this.account.sessions.set(sessionId, newSession)
      this.fire('join-session', { sessionId, newSession })
      this.fire('set-sessions', { sessions: this.getSessions() })
    } catch (err) {
      /* do nothing */
    }
  }

  async findSessions({ sessionId, title, accountId }: { sessionId?: string, title?: string, accountId?: string }) {
    try {
      const response = await fetch('/session/find', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          sessionId,
          accountId,
          title
        })
      })
      const responseJson = await response.json()
      const { success, errors = [], sessions } = responseJson
      if (!success) {
        this.fire('find-session', { success, errors })
        return
      }
      this.fire('find-session', { sessions })
      return sessions
    } catch (err) {
      /* do nothing */
    }
    return []
  }

  async joinSessionFromUrl() {
    const sessionId = this.getSessionFromUrl()
    if (!sessionId) { return }

    return this.joinSession({ sessionId })
  }

  async leaveSession({ sessionId }: { sessionId: string }) {
    if (!this.account.sessions.has(sessionId)) { return }
    try {
      const response = await fetch('/session/leave', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ sessionId })
      })
      const responseJson = await response.json()
      const { success, errors = [] } = responseJson
      if (!success) {
        this.fire('leave-session', { success, errors: [ 'Could not leave session' ].concat(errors) })
        return
      }
      this.account.sessions.delete(sessionId)
      this.fire('leave-session', { sessionId })
      this.fire('set-sessions', { sessions: this.getSessions() })
    } catch (err) {
      /* do nothing */
    }
  }

  getSessions(): Session[] {
    return Array.from(this.account.sessions.values())
  }

  setActiveSession(sessionId = '') {
    if (!sessionId) {
      this.fire('active-session', { sessionId: '', session: undefined })
      this.activeSession = ''
      return
    }

    const session = this.account.sessions.get(sessionId)
    if (!session) return

    this.activeSession = sessionId
    this.fire('active-session', { sessionId, session })

    session.getNodes()
  }

  getActiveSession() {
    return this.account.sessions.get(this.activeSession)
  }

}

export default JdamClient
