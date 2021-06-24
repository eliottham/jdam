import Evt from './evt'
import LoopNode from './loop_node'
import Settings from './settings'
import JdamClient from './jdam_client'
import UID from './uid'
import Metro from './metro'
import Sound, { SoundParams, Frames } from './sound'
import Transport, { ITransport } from './sound_transport'

export interface SessionSettingsParams {
  setting1: string
}

type GenericResponse = { [index: string]: any }

class SessionSettings extends Settings {
}

interface SessionParams {
  sessionId: string
  title: string
  sessionLength?: number
  description?: string
  rootNode?: LoopNode
  accounts?: string[]
  settings?: SessionSettingsParams
  audioCtx?: AudioContext
  client: JdamClient
}

interface SessionInfo {
  id: string
  title: string
  description: string
  sessionLength: number
  start: number
  end: number 
  duration: number 
  maxDepth: number 
  maxWidth: number
  pattern: number[]
  bpm: number
  measures: number
  ms: number
}

/* 
 * this class will act as its own client and connect directly
 * to an active container running the session server software
 */
class Session extends Evt implements ITransport {
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
  settings = new SessionSettings()
  client: JdamClient
  metro = new Metro()
  sounds: Map<string, Sound> = new Map()
  audioCtx: AudioContext

  _editingSound?: Sound
  _editingSoundInit?: Sound
  _editorTransport: Transport

  masterGain: GainNode
  transport: Transport

  constructor({
    sessionId,
    title,
    description,
    sessionLength,
    accounts = [],
    client,
    audioCtx
  }: SessionParams) {
    super()
    Object.assign(this, {
      sessionId,
      title,
      description,
      sessionLength
    })

    this.client = client

    this.setAccounts(accounts)

    if (!sessionId) { throw Error('session id is required') }

    this.getInfo()

    if (!audioCtx) {
      this.audioCtx = new AudioContext()
    } else {
      this.audioCtx = audioCtx
    }

    this.transport =  new Transport({ audioCtx: this.audioCtx })
    this._editorTransport = new Transport({ audioCtx: this.audioCtx })

    this.masterGain = this.audioCtx.createGain()
    this.masterGain.connect(this.audioCtx.destination)

    this.transport.on('set-play-state', (params: GenericResponse) => {
      this.fire('set-play-state', params)
    })

    this.transport.on('set-playhead', (params: GenericResponse) => {
      this.fire('set-playhead', params)
    })

    this._editorTransport.sync(this.transport)

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

    this.fire('set-accounts', { accounts: this.getAccounts() })
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

  getInfo() {
    this.client.wsSend('jam', JSON.stringify({ 
      token: this.client.authToken,
      sessionId: this.sessionId,
      req: 'info'
    }))
  }

  setInfo(params: SessionInfo) {
    Object.assign(this.info, params)
    this.transport.setLoopLength({ loopLength: params.ms })
    this._editorTransport.setLoopLength({ loopLength: params.ms })
    this.fire('set-info', { info: this.info })
  }

  setSounds(sounds: SoundParams[]) {
    const newSounds = new Map<string, Sound>()
    for (const sound of sounds) {
      const newSound = new Sound(sound)
      newSound.canEdit = this.client.account.id === sound.accountId
      newSounds.set(newSound.uid, newSound)
      if (!this.sounds.has(newSound.uid)) {
        this.sounds.set(newSound.uid, newSound)
      }
    }
    /* 
     * clear entries from sounds if they are not present
     * in the new set 
     */
    for (const [ uid, sound ] of this.sounds) {
      if (!newSounds.has(uid)) {
        this.sounds.delete(uid)
      } else if (!sound.file) {
        this.downloadSoundFile(uid)
      }
    }
    this.fire('set-sounds', { sounds: Array.from(this.sounds.values()) })
    this.routeChain({})
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

  async getNodes() {
    this.client.wsSend('jam', JSON.stringify({ 
      token: this.client.authToken,
      sessionId: this.sessionId,
      req: 'nodes' 
    }))
  }

  handleResponse(params: GenericResponse) {
    /* TODO: all of the possible responses */

    /* if you're wondering why it's a bunch of if statements instead of an
     * if-else chain or a switch, it's because multiple responses can be
     * grouped in a message, and all of them need to be handled
     */

    if (params.info) {
      const { title, description, accounts = [], sounds = [] } = params.info  
      Object.assign(this, { title, description })
      if (sounds.length) {
        this.setSounds(sounds as SoundParams[])
      }
      this.setAccounts(accounts)
      this.setInfo(params.info)
    } 

    if (params.addAccount) {
      this.accounts.add(params.addAccount)
      this.fire('set-accounts', { accounts: this.getAccounts() })
    } 

    if (params.deleteAccount) {
      this.accounts.delete(params.deleteAccount)
      this.fire('set-accounts', { accounts: this.getAccounts() })
    } 

    if (params.root) {
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
      this.routeChain({})
    } 
    if (params.addedNode) {
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
        this.routeChain({})
      }
      return newNode
    } 

    if (params.deletedNode) {
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
      this.routeChain({})
    } 

    if (params.addedSound || params.updatedSound) {
      const soundParams = (params.addedSound || params.updatedSound) as GenericResponse

      const { 
        accountId,
        ownerNode,
        uid,
        name, 
        gain = 1,
        pan = 0, 
        stops = []
      } = soundParams

      if (!uid) { return }

      const existingSound = this.sounds.get(uid)

      if (existingSound) {
        /* 'ownerNode' from the response is a string */
        delete soundParams.ownerNode
        Object.assign(existingSound, soundParams)
        this.fire('update-sound', { sound: existingSound })
        existingSound.fire('update-sound', { sound: existingSound })
      } else {
        const newSoundData = { 
          accountId,
          uid,
          name: name || uid.slice(0, 12),
          gain,
          pan,
          stops
        } 

        const sound = new Sound(newSoundData)
        sound.canEdit = this.client.account.id === sound.accountId
        this.sounds.set(uid, sound)

        if (ownerNode && !params.assignedSound) {
          /* 
           * so there is a case where both added sound and assignedSound may be
           * returned - if this is the case, then do not continue this process
           */
          this.assignSoundToNode({ nodeUid: ownerNode, soundUid: uid })
        }
        
        this.downloadSoundFile(uid)

        this.fire('add-sound', { sound })
        this.fire('set-sounds', { sounds: Array.from(this.sounds.values()) })
      }
    } 

    if (params.assignedSound && params.toNode) {
      const { assignedSound, toNode, fromNode } = params
      const { node: targetNode } = this.findNode(toNode)
      const sound = this.sounds.get(assignedSound.uid)
      if (sound && targetNode) {
        sound.ownerNode = targetNode
        targetNode.sounds.add(sound.uid)
        /* 
         * TODO: this needs to move in to the node object, but "assignSound" is
         * already used in that object to initiate the process with the session
         * server
         */
        if (fromNode) {
          const { node: sourceNode } = this.findNode(fromNode)
          if (sourceNode) {
            sourceNode.sounds.delete(sound.uid)
          }
        }

        /* also continue down the chain and update child nodes */
        const updateChildNodes = (node: LoopNode) => {
          node.fire('assign-sound', { assignedSound: sound, toNode: targetNode })
          if (node.children.length) {
            for (const child of node.children) {
              updateChildNodes(child)
            }
          }
        }
        updateChildNodes(targetNode)

        this.fire('assign-sound', { assignedSound: sound, toNode: targetNode })
        this.routeChain({})
      }
    } 

    if (params.uploadedSoundFile) {
      const { uploadedSoundFile: uid } = params
      const existingSound = this.sounds.get(uid)
      if (existingSound && !existingSound.file) {
        this.downloadSoundFile(uid)
      }
    } 

    if (params.deletedSound) {
      const { deletedSound } = params
      if (this.sounds.has(deletedSound)) {
        const existingSound = this.sounds.get(deletedSound)
        if (existingSound) {
          existingSound.ownerNode?.sounds.delete(existingSound.uid)
          existingSound.ownerNode?.fire('delete-sound', { sound: existingSound })
        }
        this.sounds.delete(deletedSound)
        this.fire('delete-sound', { sound: existingSound })
        this.fire('set-sounds', { sounds: Array.from(this.sounds.values()) })
      }
    } 

    if (params.error) {
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
          gain: sound.gain,
          pan: sound.pan,
          accountId: sound.accountId,
          nodeUid: sound.ownerNode?.uid,
          stops: sound.stops
        }
      }
    }))
  }

  deleteSound(uid: string) {
    this.client.wsSend('jam', JSON.stringify({
      token: this.client.authToken,
      sessionId: this.sessionId,
      req: { deleteSound: uid }
    }))
  }

  async uploadSoundFile({ file, soundUid }: { file: File, soundUid: string }) {
    const response = await fetch(`/sessions/${this.sessionId}/stream/upload?fileId=${soundUid}`, {
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

    this.fire('upload-sound-file', { uid: soundUid, file })
  }

  async downloadSoundFile(uid: string) {

    const maxAttempts = 3

    /* 
     * set up helper function to attempt to download file multiple times if
     * audio buffer cannot be decoded 
     */
    const download = async (attempts = 0): Promise<{ file?: File, audioBuffer?: AudioBuffer }> => {
      const response = await fetch(`/sessions/${this.sessionId}/stream/download/${uid}`, {
        method: 'GET'
      })

      const contentType = response.headers.get('Content-Type')
      if (!contentType) {
        this.fire('download-sound-file', { errors: [ 'no content type / file not found' ] })
        return {}
      }

      const fileType = contentType?.split(';')[0].split('/')[1]

      const blob = await response.blob()

      const file = new File([ blob ], `${uid}.${fileType}`, {
        type: contentType
      })

      try {
        const arrayBuffer = await blob.arrayBuffer()
        const audioBuffer = await this.audioCtx.decodeAudioData(arrayBuffer)
        return { file, audioBuffer }
      } catch (err) {
        if (attempts < maxAttempts) { return await download(attempts + 1) }
      }
      return {}
    }

    const { file, audioBuffer } = await download()

    if (!file || !audioBuffer) { return }

    this.fire('download-sound-file', { file })

    const sound = this.sounds.get(uid)

    if (sound) {
      try {
        const { frames, ms } = await this.getSoundPeaks({ file })
        this.assignFileToSound({ file, audioBuffer, frames, sound, ms })
        return
      } catch (err) {
        this.fire('errors', { errors: [ 'could not fetch sound peaks' ] })
      }

      this.assignFileToSound({ file, sound, audioBuffer })
    }
  }

  editSound({ node, sound = this._editingSound }: { node?: LoopNode, sound?: Sound}) {
    if (!sound) {
      this._editingSound = new Sound({
        uid: UID.hex(24),
        name: `New Sound ${this.sounds.size + 1}`,
        gain: 1,
        pan: 0,
        ownerNode: node,
        stops: [],
        accountId: this.client.account.id,
        canEdit: true
      })
    } else {
      if (!sound.canEdit) { return }
      this._editingSound = sound
      this._editingSoundInit = sound.copy()
    }

    /* cram the current sound in to the transport and set the playhead back to 0 */
    this.transport.stop()
    this._editorTransport.stop()
    this._editorTransport.setSounds({ sounds: [ this._editingSound ] })
    if (this._editingSound.stops) {
      this._editorTransport.leadIn(this._editingSound.stops[1])
    }

    /* check if editing an existing sound */
    this.fire('edit-sound', { sound: this._editingSound, newSound: !this.sounds.has(this._editingSound.uid) }) 
  }

  editNewSound({ node }: { node?: LoopNode }) {
    /* force a new editing sound to be created */
    this.editSound({ node, sound: undefined })
  }

  cancelEditSound() {
    const sound = this._editingSound

    /* restore from backup */
    if (this._editingSoundInit) {
      Object.assign(sound, this._editingSoundInit)
    }

    this._editingSound = undefined
    this._editingSoundInit = undefined
    this._editorTransport.stop()
    this._editorTransport.setSounds({ sounds: [] })
    this.fire('cancel-edit-sound', { sound }) 
  }

  async saveEditSound() {
    const sound = this._editingSound

    if (!sound || !sound.ownerNode || !sound.file) { 
      this.cancelEditSound()
      return 
    }

    this._editingSound = undefined
    this._editingSoundInit = undefined
    this.transport.setSounds({ sounds: [] })

    /* 
     * don't place copy over old reference, this will break all the references 
     * upsert will handle updating existing sound anyway
     */
    if (!this.sounds.has(sound.uid)) {
      this.sounds.set(sound.uid, sound)
    }

    /* 
     * upsert sound will tell other clients about this new sound information
     * but it will not update the one already in the set
     * upsertSound's response handler will automatically call "assignSoundToNode'
     *
     * edits to an existing sound will also be automatically handled
     */
    this.upsertSound(sound)
    if (sound.file) {
      await this.uploadSoundFile({ file: sound.file, soundUid: sound.uid })
    }
    this.fire('save-edit-sound', { sound }) 
  }

  async deleteEditSound() {
    const sound = this._editingSound

    if (!sound || !sound.ownerNode || !sound.file) { 
      this.cancelEditSound()
      return 
    }

    const existingSound = this.sounds.get(sound.uid)
    if (!existingSound) {
      this.cancelEditSound()
      return 
    }

    this.deleteSound(sound.uid)
    this.fire('delete-edit-sound', { existingSound }) 
    this.cancelEditSound()
  }

  assignFileToSound({
    file,
    audioBuffer,
    frames,
    ms,
    sound
  }: {
    file: File,
    audioBuffer: AudioBuffer
    frames?: Frames,
    ms?: number,
    sound: Sound 
  }) {
    /* transport will also fire the event for the sound object */
    if (sound === this._editingSound) {
      this._editorTransport.setSoundFile({ file, audioBuffer, frames, ms, sound })
      this._editorTransport.resetSoundStops({ sound })
    } else {
      this.transport.setSoundFile({ file, audioBuffer, frames, ms, sound })
    }
    this.fire('set-sound-file', { file, audioBuffer, frames, ms, sound })
  }

  async convertSoundFile({ file, start, end }: { file: File, start?: number, end?: number }) {
    /* trim also converts the file */
    const urlParams = new URLSearchParams()
    if (typeof start === 'number') {
      urlParams.append('start', '' + start)
    }
    if (typeof end === 'number') {
      urlParams.append('end', '' + end)
    }
    const response = await fetch(`/waves/trim`, {
      method: 'POST',
      headers: {
        'Content-Type': file.type
      },
      body: file 
    })
    const responseBlob = await response.blob()
    const newFile = new File(
      [ responseBlob ],
      file.name, {
        type: response.headers.get('content-type') || 'audio/flac'
      })

    this.fire('convert-sound-file', { file: newFile })
    return newFile
  }

  async getSoundPeaks({ file }: { file: File }) {
    const response = await fetch(`/waves/peaks`, {
      method: 'POST',
      headers: {
        'Content-Type': file.type
      },
      body: file 
    })
    const responseJson = await response.json()
    const { success, errors, frames, ms } = responseJson
    if (!success) {
      this.fire('sound-peaks', { errors })
    }

    this.fire('sound-peaks', { file, frames, ms })
    return { file, frames, ms }
  }

  async processAndConvertSoundFile({ sound, file }: { sound?: Sound, file: File }) {
    if (sound) {
      delete sound.file
      sound.frames = []
      sound.fire('set-sound-file', { sound, file: undefined })
      sound.fire('process-pending', { sound, file })
      this.fire('process-pending', { sound, file })
    }

    const newFile = await this.convertSoundFile({ file })
    const { frames, ms } = await this.getSoundPeaks({ file: newFile })

    /* immediately convert to audioBuffer */
    try {
      const arrayBuffer = await newFile.arrayBuffer()
      const audioBuffer = await this.audioCtx.decodeAudioData(arrayBuffer)

      this.fire('process-sound-file', { file: newFile, audioBuffer, frames, ms })

      if (sound) {
        this.assignFileToSound({ file: newFile, audioBuffer, frames, sound, ms })
      }

      return { file: newFile, audioBuffer, frames, ms }

    } catch (err) {
      /* do nothing */
    }
  
    return { file: newFile, frames, ms }
  }

  routeChain({ endNode }: { endNode?: LoopNode }) {
    if (!endNode) {
      const nodeChain = this.rootNode.chain()
      if (nodeChain.length < 1) { return } /* this means there are no nodes */

      endNode = nodeChain[nodeChain.length - 1]
    }

    const sounds = [ ...endNode.getInheritedSounds(), ...endNode.getSounds() ]

    this.transport.setSounds({ sounds })
  }

  async playChain({ endNode }: { endNode?: LoopNode }) {
    await this.routeChain({ endNode })
    this.play()
  }

  setPlayhead(ms: number) {
    this.transport.setPlayhead(ms)
    this.fire('set-playhead', { ms })
  }

  setPlayState(state: string) {
    this._editorTransport.stop()
    this.transport.setPlayState(state)
    this.fire('set-play-state', { playState: state })
  }

  play() {
    this.transport.play()
  }

  pause() {
    this.transport.pause()
  }

  playPause(nodeUid?: string) {
    if (this.transport.playState === 'stopped') {
      if (!nodeUid) {
        this.playChain({})
      } else {
        const { node } = this.findNode(nodeUid)
        this.playChain({ endNode: node })
      }
    } else {
      this.transport.playPause()
    }
  }

  stop() {
    this.transport.stop()
  }

  getPlayState() { return this.transport.getPlayState() }

}

export default Session
