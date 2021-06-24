import Mongo from 'mongodb'
import net from 'net'
import LoopNode from './loop_node.mjs'
import fs, { promises as fsp } from 'fs'
import { Transform } from 'stream'
import path from 'path'
import crypto from 'crypto'
import { paramParse } from 'jdam-utils'
import http from 'http'
const { MongoClient, ObjectID } = Mongo

const PORT = 25052
const NO_DOCKER = (process.env.NO_DOCKER === 'true' ? true : false)
const CONTAINER = process.env.HOSTNAME
const TITLE = process.env.TITLE
const DESCRIPTION = process.env.DESCRIPTION
const SESSION_LENGTH = Number(process.env.SESSION_LENGTH ?? 1) /* in minutes */
const MONGO_URL = `mongodb://${NO_DOCKER ? 'localhost' : 'host.docker.internal'}:27017`
const MONGO_DB_NAME = 'jdam'
const PATTERN = JSON.parse(process.env.PATTERN || "[ 2, 1, 1, 1 ]")
const BPM = Number(process.env.BPM || "120")
const MEASURES = Number(process.env.MEASURES || "4")

const FFMPEG_URL = `http://${NO_DOCKER ? 'localhost' : 'host.docker.internal'}:48000`

const MAX_DEPTH = 4
const MAX_WIDTH = 4

const START_TS = new Date().valueOf()

const separator = ':'.charCodeAt()

const mongoClient = new MongoClient(MONGO_URL, { useUnifiedTopology: true })
let db

const connectedAccounts = new Set()
const connectedSockets = new Set()
const rootNode = new LoopNode()
const sounds = new Map()

const inProgressSoundStreams = new Map()

rootNode.uid = 'root-node'

function generateRandomBitString(length, encoding = 'base64') {
  const byteBuffer = Buffer.allocUnsafe(length) 
  crypto.randomFillSync(byteBuffer)
  return byteBuffer.toString(encoding)
}

function response(mId, ob) {
  const message = mId + ':' + JSON.stringify({
    res: { connectedAccounts: Array.from(connectedAccounts), ...ob }
  })
  console.log(message)
  return message
}

function getInfo() {
  const currentTs = new Date().valueOf()
  return {
    id: CONTAINER,
    title: TITLE,
    description: DESCRIPTION,
    sessionLength: SESSION_LENGTH,
    start: START_TS,
    end: START_TS + (SESSION_LENGTH * 60 * 1000),
    duration: currentTs - START_TS,
    maxDepth: MAX_DEPTH,
    maxWidth: MAX_WIDTH,
    pattern: PATTERN,
    bpm: BPM,
    ms: (60 / BPM ) * PATTERN.length * MEASURES * 1000,
    measures: MEASURES,
    accounts: Array.from(connectedAccounts),
    sounds: getSounds()
  }
}

function getSounds() {
  return Array.from(sounds.values()).map(sound => {
    const abbrSound = { ...sound }
    if (sound.ownerNode) {
      abbrSound.ownerNode = sound.ownerNode.uid
    }
    return abbrSound
  })
}

function findSoundFile(fileId) {
  const files = fs.readdirSync(path.resolve('./sounds'))

  /* the first character is a dot; slice everything after that */
  const fileType = path.extname(files.find(file => file.startsWith(fileId))).slice(1)
  const resolvedPath = path.resolve(`./sounds/${fileId}.${fileType}`)
  return resolvedPath
}

function beginSoundStream({ action, socket, fileId, fileType, length }) {
  const errors = []
  if (!fileId) {
    errors.push('fileId not specified') 
  } else if (/\W/.test(fileId)) {
    errors.push('fileId must only contain word characters')
  }

  if (action === 'upload') {
    if (!fileType) { errors.push('file type not specified') }
    if (!length) { errors.push('length not specified') }
    length = Number(length)
    if (isNaN(length)) { errors.push('length must be a number') }

    /* 
     * only allow one upload for a give fileId, but if simultaneous downloads
     * are requested, then that is acceptable
     */
    if (inProgressSoundStreams.has(fileId)) { errors.push('there is already a pending upload for this fileId') }
  }

  if (errors.length) { throw Error(errors.join('\n')) }

  const streamMeta = {
    action,
    fileId,
    fileType,
    length,
    offset: 0
  }

  const monitor = new Transform({
    transform(chunk, encoding, callback) {
      // console.log(chunk.length)
      callback(null, chunk)
    }
  })

  if (action === 'upload') {
    const resolvedPath = path.resolve(`./sounds/${fileId}.${fileType}`)
    const writeStream = fs.createWriteStream(resolvedPath)
    writeStream.on('error', (err) => {
      inProgressSoundStreams.delete(socket)
      console.error('upload error', err)
    })
    writeStream.on('close', () => {
      inProgressSoundStreams.delete(socket)
      try {
        messageAll({
          uploadedSoundFile: fileId
        })
      } catch (err) {
        messageAll({
          error: err.message
        })
      }
    })
    socket.write(`fileType=${fileType};`, () => {
      socket.pipe(monitor).pipe(writeStream)
    })
    streamMeta.writeStream = writeStream
  } else if (action === 'download') {
    const resolvedPath = findSoundFile(fileId)
    const fileType = path.extname(resolvedPath).slice(1)
    const readStream = fs.createReadStream(resolvedPath)
    readStream.on('error', (err) => {
      inProgressSoundStreams.delete(socket)
      console.error('download error', err)
    })
    readStream.on('end', () => {
      inProgressSoundStreams.delete(socket)
    })
    socket.write(`fileType=${fileType};`, () => {
      readStream.pipe(monitor).pipe(socket)
    })
    streamMeta.readStream = readStream
  }

  inProgressSoundStreams.set(socket, streamMeta)
  return streamMeta
}

async function addAccount(accountId) {
  const sessions = db.collection('sessions')
  const accounts = db.collection('accounts')

  await Promise.all([
    sessions.updateOne(
      { _id: CONTAINER },
      { '$addToSet': { accounts: ObjectID(accountId) }}
    ),
    accounts.updateOne(
      { _id: ObjectID(accountId) },
      { '$addToSet': { sessions: CONTAINER }}
    )
  ])

  connectedAccounts.add(accountId)
}

async function deleteAccount(accountId) {
  const sessions = db.collection('sessions')
  const accounts = db.collection('accounts')

  await Promise.all([ 
    sessions.updateOne(
      { _id: CONTAINER },
      { '$pull': { accounts: ObjectID(accountId) }}
    ),
    accounts.updateOne(
      { _id: ObjectID(accountId) },
      { '$pull': { sessions: CONTAINER }}
    )
  ])

  connectedAccounts.delete(accountId)
}

function findNode(uid) {
  const recurse = (node, depth) => {
    if (node.uid === uid) { return { node, depth } }
    else { 
      for (const child of node.children) {
        const result = recurse(child, depth + 1)
        if (result) { return result }
      }
    }
    return undefined
  }

  return recurse(rootNode, 0)
}

function abbreviateNode(node) {
  const result = {
    uid: node.uid
  }
  if (node.parent) {
    result.parentUid = node.parent.uid
  }
  if (node.children.length) {
    result.childrenUids = node.children.map(child => {
      return child.uid
    })
  }
  if (node.sounds.size) {
    /* 
     * prevent circular dependency issue involving the parent-child
     * relationship between sound and ownerNode
     */
    result.sounds = Array.from(node.sounds)
  }
  return result
}

function addNode({ parentUid }) {
  if (!parentUid) { 
    const newNode = new LoopNode({})
    if (rootNode.children.length < MAX_WIDTH) {
      rootNode.children.push(newNode)
      return { addedNode: abbreviateNode(newNode) } 
    } else {
      throw Error(`Cannot add another node to ${parentUid}`)
    }
  } else {
    const { node: parentNode, depth } = findNode(parentUid)
    if (!parentNode) {
      throw Error('Parent UID not found in nodes')
    }
    if (depth >= MAX_DEPTH) {
      throw Error(`Maximum depth of ${MAX_DEPTH} been reached`)
    }
    const newNode = new LoopNode({parent: parentNode})
    if (parentNode.children.length < MAX_WIDTH) {
      parentNode.children.push(newNode)
      return { addedNode: abbreviateNode(newNode) } 
    } else {
      throw Error(`Cannot add another node to ${parentUid}`)
    }
  }
}

function deleteNode({ uid }) {
  const { node } = findNode(uid)
  if (!node) {
    throw Error('Node UID not found in nodes')
  }

  const indexOf = node.parent.children.indexOf(node)
  node.parent.children.slice(indexOf, 1)

  return { deletedNode: abbreviateNode(node) }
}

function upsertSound(params = {}) {

  if (typeof params !== 'object') { throw Error('params must be an object') }

  const { 
    nodeUid,
    accountId,
    uid = generateRandomBitString(12, 'hex'),
    name, 
    volume = 1,
    pan = 0, 
    stops = [],
    path 
  } = params

  const existingSound = sounds.get(uid)

  const newSoundData = { 
    accountId,
    uid,
    name: name || uid.slice(0, 12),
    volume,
    pan,
    stops,
    path
  }

  const result = {}
    
  if (existingSound) {
    Object.assign(existingSound, params)
    result.updatedSound = { ...existingSound }
    if (existingSound.ownerNode) {
      result.updatedSound.ownerNode = existingSound.ownerNode.uid
    }
  } else {
    sounds.set(uid, newSoundData)
    result.addedSound = { ...newSoundData, ownerNode: nodeUid }
  }

  if (nodeUid) {
    Object.assign(result, assignSoundToNode({ nodeUid, soundUid: uid }))
  }

  return result
}

function deleteSound(uid) {
  if (sounds.has(uid)) {
    const existingSound = sounds.get(uid)

    /* delete from global list and from the sound's owner node */
    if (existingSound && existingSound.ownerNode) {
      existingSound.ownerNode.sounds.delete(uid)
    }
    sounds.delete(uid)
    const resolvedPath = findSoundFile(uid)

    /* remove sound file */
    try {
      fs.rmSync(resolvedPath)
    } catch (err) {
      console.error(Error("attempted to delete a file that isn't there"))
    }
    return { deletedSound: uid }
  }
}

function assignSoundToNode({ nodeUid, soundUid }) {
  const sound = sounds.get(soundUid)
  if (!sound) { throw Error('sound not found') }

  const { node } = findNode(nodeUid)
  if (!node) { throw Error('node not found') }

  const result = {}
  if (sound?.ownerNode && sound.ownerNode.uid !== nodeUid) {
    sound.ownerNode.sounds.delete(soundUid)
    result.fromNode = sound.ownerNode.uid
  }

  node.sounds.add(soundUid)
  sound.ownerNode = node
  return { 
    assignedSound: { ...sound, ownerNode: node.uid },
    toNode: node.uid, ...result 
  }
}

function getNodes() {
  const recurse = node => {
    const result = abbreviateNode(node)
    result.children = node.children.map(child => recurse(child))
    return result
  }
  return { root: recurse(rootNode) }
}

function messageAll(payload, excludeSocket) {
  for (const socket of connectedSockets) {
    if (socket === excludeSocket) { continue }
    socket.write(response('-1', payload))
  }
}

async function processRequest(mId, req, socket) {
  console.dir(req)
  const payload = {}
  if (typeof req === 'string') {
    switch (req) {
    case 'info':
      Object.assign(payload, { info: getInfo() })
      break
    case 'nodes':
      Object.assign(payload, getNodes())
      break
    case 'sounds':
      Object.assign(payload, { sounds: getSounds() })
      break
    }
  } else if (typeof req === 'object') {
    /* TODO: handle complex object requests */
    try {
      if (req.addAccount) {
        await addAccount(req.addAccount)
        Object.assign(payload, {
          addAccount: req.addAccount
        })
      } else if (req.deleteAccount) {
        await deleteAccount(req.deleteAccount)
        Object.assign(payload, { 
          deleteAccount: req.deleteAccount
        })
      } else if (req.endSession) {
        exit()
      } else if ('addNode' in req) {
        Object.assign(payload, addNode({
          parentUid: req.addNode 
        }))
      } else if (req.deleteNode) {
        Object.assign(payload, deleteNode({
          uid: req.deleteNode
        }))
      } else if (req.assignSound && req.toNode) {
        Object.assign(payload, assignSoundToNode({
          soundUid: req.assignSound,
          nodeUid: req.toNode
        }))
      } else if (req.upsertSound) {
        Object.assign(payload, upsertSound(req.upsertSound))
      } else if (req.deleteSound) {
        Object.assign(payload, deleteSound(req.deleteSound))
      }
    } catch (err) {
      Object.assign(payload, { 
        error: err.message
      })
    }
  }
  if (Object.keys(payload).length) {
    socket.write(response(mId, payload))
    messageAll(payload, socket)
  }
}

const sessionServer = net.createServer(socket => {

  connectedSockets.add(socket)
  console.dir('add socket', socket)

  messageAll({ start: getInfo() })

  socket.on('data', data => {
    try {
      let splitIndex = -1
      for (let a = 0; a < data.length; a++) {
        const code = data[a]
        if (code === separator) {
          splitIndex = a
          break
        }
      }
      const mId = data.slice(0, splitIndex) 
      try {
        const json = JSON.parse(data.slice(splitIndex + 1))
        const { req } = json
        processRequest(mId, req, socket)
      } catch (err) {
        socket.write(response(mId, { error: 'not json' }))
      }
    } catch (err) {
      socket.write(response('-1', { error: 'no message id or invalid message format' }))
    }
  })
  socket.on('error', () => {
    connectedSockets.delete(socket)
  })
  socket.on('close', () => {
    connectedSockets.delete(socket)
  })

})

const streamingServer = net.createServer(socket => {
 
  socket.once('data', data => {
    const dataParams = paramParse(data)
    const { action, fileId, fileType, length } = dataParams
    try {
      beginSoundStream({ action, socket, fileId, fileType, length })
    } catch (err) { 
      inProgressSoundStreams.delete(socket)
      socket.write(`error=${err.message};`)
    }
  })
})

async function exit() {
  for (const socket of connectedSockets) {
    socket.write(response('-1', { 
      endSession: true
    }))
    socket.end()
  }
  const sessions = db.collection('sessions')
  const accounts = db.collection('accounts')

  await sessions.deleteOne({ _id: CONTAINER })

  /* 
   * also have to update all accounts to pull this container
   * from their sessions list
   */

  await accounts.updateMany(
    { sessions: CONTAINER },
    { '$pull': { sessions: CONTAINER }}
  )

  process.exit(1)
}

async function begin() {

  await fsp.mkdir(path.resolve('./sounds'), { recursive: true })

  sessionServer.listen(PORT, () => {
    console.log(`session server running on port: ${PORT}`) /* do nothing */ 
  })

  streamingServer.listen(PORT + 1, () => {
    console.log(`streaming server running on port: ${PORT + 1}`) /* do nothing */ 
  })

  try {
    await mongoClient.connect()
    console.log('Connected successfully to server')

    db = mongoClient.db(MONGO_DB_NAME)

    const sessions = db.collection('sessions')
    await sessions.updateOne(
      { _id: CONTAINER },
      { '$set': { active: true }}
    )
  } catch (err) {
    /* do nothing */
    console.dir(err)
  }

  const client = net.createConnection({ host: NO_DOCKER ? 'localhost' : 'host.docker.internal', port: 25051 }, () => { 
    client.write(CONTAINER)
  })
  
  console.log(CONTAINER)

  /* 
   * kill the jam session after some upper limit of time 
   * this will happen assuming the session has not already
   * been simulation terminated by then
   */
  setTimeout(() => {
    exit()
  }, SESSION_LENGTH * 60 * 1000)
}

begin()
