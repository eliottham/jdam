import Mongo from 'mongodb'
import net from 'net'
const { MongoClient, ObjectID } = Mongo

const PORT = 25052
const NO_DOCKER = (process.env.NO_DOCKER === 'true' ? true : false)
const CONTAINER = process.env.HOSTNAME
const NAME = process.env.NAME
const SESSION_LENGTH = process.env.SESSION_LENGTH ?? 1 /* in minutes */
const MONGO_URL = `mongodb://${NO_DOCKER ? 'localhost' : 'host.docker.internal'}:27017`
const MONGO_DB_NAME = 'jdam'

const START_TS = new Date().valueOf()

const mongoClient = new MongoClient(MONGO_URL, { useUnifiedTopology: true })
let db

const connectedAccounts = new Set()
const connectedSockets = new Set()

function response(ob) {
  return JSON.stringify({
    res: { connectedAccounts: Array.from(connectedAccounts), ...ob }
  })
}

function getInfo() {
  const currentTs = new Date().valueOf()
  return {
    containerId: CONTAINER,
    name: NAME,
    sessionLength: SESSION_LENGTH,
    start: START_TS,
    end: START_TS + (SESSION_LENGTH * 60 * 1000),
    duration: currentTs - START_TS
  }
}

async function addAccount(accountId) {
  const sessions = db.collection('sessions')

  await sessions.updateOne(
    { _id: CONTAINER },
    { '$addToSet': { accounts: new ObjectID(accountId) }}
  )

  connectedAccounts.add(accountId)
}

async function deleteAccount(accountId) {
  const sessions = db.collection('sessions')

  await sessions.updateOne(
    { _id: CONTAINER },
    { '$pull': { accounts: new ObjectID(accountId) }}
  )

  connectedAccounts.delete(accountId)
}

async function processRequest(req, socket) {
  console.dir(req)
  if (typeof req === 'string') {
    switch (req) {
    case 'info':
      socket.write(response(getInfo()))
      break
    }
  } else if (typeof req === 'object') {
    /* TODO: handle complex object requests */
    if (req.addAccount) {
      try {
        await addAccount(req.addAccount)
        socket.write(response({
          addAccount: req.addAccount
        }))
      } catch (err) {
        socket.write(response({ 
          error: err.message
        }))
      }
    } else if (req.deleteAccount) {
      try {
        await deleteAccount(req.deleteAccount)
        socket.write(response({ 
          deleteAccount: req.deleteAccount
        }))
      } catch (err) {
        socket.write(response({ 
          error: err.message
        }))
      }
    } else if (req.endSession) {
      exit()
    }
  }
}

const sessionServer = net.createServer(socket => {

  connectedSockets.add(socket)
  console.dir('add socket', socket)

  socket.on('data', data => {
    try {
      const json = JSON.parse(data)
      const { req } = json
      processRequest(req, socket)
    } catch (err) {
      /* not json */
      socket.write(response({ errors: [ 'not json' ] }))
    }
  })
  socket.on('error', () => {
    connectedSockets.delete(socket)
  })
})

async function exit() {
  for (const socket of connectedSockets) {
    socket.write(response({ 
      endSession: true
    }))
    socket.end()
  }
  const sessions = db.collection('sessions')
  await sessions.deleteOne({ _id: CONTAINER })
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
