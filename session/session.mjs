import Mongo from 'mongodb'
import net from 'net'
import LoopNode from './loop_node.mjs'
const { MongoClient, ObjectID } = Mongo

const PORT = 25052
const NO_DOCKER = (process.env.NO_DOCKER === 'true' ? true : false)
const CONTAINER = process.env.HOSTNAME
const TITLE = process.env.TITLE
const DESCRIPTION = process.env.DESCRIPTION
const SESSION_LENGTH = Number(process.env.SESSION_LENGTH ?? 1) /* in minutes */
const MONGO_URL = `mongodb://${NO_DOCKER ? 'localhost' : 'host.docker.internal'}:27017`
const MONGO_DB_NAME = 'jdam'

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
rootNode.uid = 'root-node'

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
    containerId: CONTAINER,
    title: TITLE,
    description: DESCRIPTION,
    sessionLength: SESSION_LENGTH,
    start: START_TS,
    end: START_TS + (SESSION_LENGTH * 60 * 1000),
    duration: currentTs - START_TS,
    maxDepth: MAX_DEPTH,
    maxWidth: MAX_WIDTH
  }
}

async function addAccount(accountId) {
  const sessions = db.collection('sessions')

  await sessions.updateOne(
    { _id: CONTAINER },
    { '$addToSet': { accounts: ObjectID(accountId) }}
  )

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

function getNodes() {
  const recurse = node => {
    const result = abbreviateNode(node)
    result.children = node.children.map(child => recurse(child))
    return result
  }
  return { root: recurse(rootNode) }
}

async function processRequest(mId, req, socket) {
  console.dir(req)
  if (typeof req === 'string') {
    switch (req) {
    case 'info':
      socket.write(response(mId, {
        info: getInfo()
      }))
      break
    case 'nodes':
      socket.write(response(mId, getNodes()))
      break
    }
  } else if (typeof req === 'object') {
    /* TODO: handle complex object requests */
    if (req.addAccount) {
      try {
        await addAccount(req.addAccount)
        socket.write(response(mId, {
          addAccount: req.addAccount
        }))
      } catch (err) {
        socket.write(response(mId, { 
          error: err.message
        }))
      }
    } else if (req.deleteAccount) {
      try {
        await deleteAccount(req.deleteAccount)
        socket.write(response(mId, { 
          deleteAccount: req.deleteAccount
        }))
      } catch (err) {
        socket.write(response(mId, { 
          error: err.message
        }))
      }
    } else if (req.endSession) {
      exit()
    } else if ('addNode' in req) {
      try {
        socket.write(response(mId, addNode({
          parentUid: req.addNode 
        })))
      } catch (err) {
        socket.write(response(mId, { 
          error: err.message
        }))
      }
    } else if (req.deleteNode) {
      try {
        socket.write(response(mId, deleteNode({
          uid: req.deleteNode
        })))
      } catch (err) {
        socket.write(response(mId, { 
          error: err.message
        }))
      }
    }
  }
}

const sessionServer = net.createServer(socket => {

  connectedSockets.add(socket)
  console.dir('add socket', socket)

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

  sessionServer.listen(PORT, () => {
    console.log(`session server running on port: ${PORT}`) /* do nothing */ 
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
