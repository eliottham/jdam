import Express from 'express'
import cookieParser from 'cookie-parser'
import { generateRandomBitString } from 'jdam-utils'
import WS from 'express-ws'
import WebSocket from 'ws'
import SessionOps from './session_ops.mjs'
import Mongo from 'mongodb'
import fs, { promises as fsp } from 'fs'
import path from 'path'
const { MongoClient, ObjectID, GridFSBucket } = Mongo

const PORT = 54049
const MONGO_URL = 'mongodb://localhost:27017'
const MONGO_DB_NAME = 'jdam'

const mongoClient = new MongoClient(MONGO_URL, { useUnifiedTopology: true })
let db
let sessionOps

const AUTH_COOK = 'auth-token'
const EXPIRATION_THRESHOLD = (15 * 60 * 1000) /* 15 minutes in ms */

/* new express app */
const appBase = Express()
const { app } = WS(appBase)
// const app = appBase
app.use(Express.static('public'))

/* remember to use the json body-parser */
app.use(Express.json())
app.use(cookieParser())

/* 
 * keep track of active authSessions
 *
 * key is a token, value is a authSession obj
 * {
 *   expires: time in ms
 *   client: websocket client
 * }
 * new requests will refresh the expiration time
 */
const authSessionMap = new Map()

/* 
 * a "reverse map" of the above, maps accountId to the token value 
 *
 * this can be used to quickly get the token by index and then message an 
 * account based on its ID value
 */
const accountAuthMap = new Map()

// app.get('/*', (req, res) => {
//   res.sendFile(path.resolve('./public', 'main.js'))
// })

app.ws('/ws', ws => {
  ws.send('connected')
  ws.on('message', msg => {
    if (typeof msg === 'string') {
      const [ prefix, mId ] = msg.split(':').slice(0, 2)
      const data = msg.slice(prefix.length + mId.length + 2)
      switch (prefix) {
      case 'tok':
      {
        const authSession = data
        const authSessionObj = authSessionMap.get(authSession) 
        if (authSessionObj) { authSessionObj.client = ws }

        break
      }
      case 'jam': {
        try {
          const json = JSON.parse(data)
          const { token, sessionId } = json
          checkAuth({ token })

          sessionOps.write(sessionId, mId, data)

        } catch (err) {
          /* 
           * do nothing, the client is trashe if they think they can just NOT
           * send json, or they aren't with a valid session
           */
        }
        break
      }
      }
    }
  })
})

function getMsFromNow(secondsDivision = 10) {

  /* 
   * calculate the timeout so that it's to next 10 seconds __absolute__ rather
   * than relative
   */
  const date = new Date
  const now = date.valueOf()

  date.setSeconds(date.getSeconds() - (date.getSeconds() % secondsDivision) + secondsDivision)
  date.setMilliseconds(0)

  return date.valueOf() - now
}

async function managementLoop() {
  setTimeout(managementLoop, getMsFromNow()) 

  /* 
   * prune authSessions every two minutes 
   */

  const now = Date.now()
  if ((now + 5000) % (60 * 2 * 1000) < 10000) {
    for (const [ key, value ] of authSessionMap.entries()) {
      if (now > value.expires) {
        if (value.client) { messageClient(value.client, `ses:-1:${JSON.stringify({ expired: true })}`) }
        if (value.id) { accountAuthMap.delete(value.id) }
        authSessionMap.delete(key)
      }
    }
  }
}

/* this is on a separate loop from the main loop, because it doesn't depend on resets */
managementLoop()

function messageClient(client, data) {
  if (!client) return

  if (client.readyState !== WebSocket.OPEN) return 

  client.send(data)
}

function dateStringIsValid(dateString) {
  if (!dateString) return false
  return /^\d{4}_\d[1-9]_\d[1-9]$/.test(dateString)
}

/*
 * 1. check the logins file for email(key),
 *    if not found, throw an "account not found" error
 *
 * 2. ...and validate that the hash(value) matches,
 *    otherwise throw a "credentials invalid" error
 */
async function validateLogin(email, hash) {
  if (!db) { throw new Error('Database not found') }

  /* look through accounts to find one matching the email */
  const account = await getAccount({ email }) 

  if (!account) {
    throw new Error('Account not found')
  }

  if (account.hash !== hash) {
    throw new Error('Credentials are invalid')
  }

  return account
}

async function createAccount({ email, hash, nickname }) {
  if (!db) { throw new Error('Database not found') }

  try {
    const accounts = db.collection('accounts')
    const { upsertedId } = await accounts.updateOne(
      { email },
      { '$setOnInsert': { email, hash, nickname, sessions: [] }},
      { upsert: true }
    )
    return { _id: upsertedId._id, email, hash, nickname }
  } catch (err) {
    throw new Error('Account not created')
  }
}

async function getAccount({ hash, id, email }) {
  if (!db) { throw new Error('Database not found') }

  const accounts = db.collection('accounts')
  let account
  if (id) {
    account = await accounts.findOne({ _id: new ObjectID(id) })
  } else if (hash) {
    account = await accounts.findOne({ hash })
  } else if (email) {
    account = await accounts.findOne({ email })
  }
  
  if (account.sessions?.length) {
    const sessions = db.collection('sessions')
    const cursor = await sessions.find(
      { _id: { '$in': account.sessions }})
    if (cursor) {
      const sessionResults = await cursor.toArray()
      account.sessions = sessionResults
    }
  }

  return account
}

/* this should probably be something like a JWT */
function generateSessionToken(withAccountId) {
  const date = new Date()
  const b64 = generateRandomBitString(24)
  authSessionMap.set(b64, { expires: date.valueOf() + EXPIRATION_THRESHOLD, ...!!withAccountId && { id: withAccountId }})
  if (withAccountId) { accountAuthMap.set(withAccountId, b64) }
  return b64
}

function checkAuth({ req, res, token }) {

  if (req) {
    if (req.cookies[AUTH_COOK]) {
      token = req.cookies[AUTH_COOK]
    } else {
      throw Error('Session not present')
    }
  }

  refreshSession({ token, res })

  const dateValue = new Date().valueOf()
  const authSessionObj = authSessionMap.get(token)
  if (!authSessionObj) {
    throw Error('Session not found')
  }

  if (dateValue > authSessionObj.expires) {
    authSessionMap.delete(token)
    if (authSessionObj.id) { accountAuthMap.delete(authSessionObj.id) }
    throw Error('Session expired')
  }

  return { token, ...authSessionObj }

}

/* 
 * handler can be async, but that shouldn't matter because we aren't doing any
 * work after it
 *
 * this function returns an async function that consumes the req and res
 * objects passed by express
 */
function useAuth(handler) {
  return (req, res) => {
    try {
      /* 
       * pass the results of checkAuth to the 
       * third param of the handler function 
       */
      handler(req, res, checkAuth({ req, res }))
    } catch (err) {
      res.status(410).json({ success: false, errors: [ err.message ] })
    }
  }
}

function refreshSession({ token, res }) {
  const dateValue = new Date().valueOf()
  const authSessionObj = authSessionMap.get(token)
  /* 
   * remember to also refresh the auth-cook on the client, so it doesn't expire
   * after refreshing
   */
  if (res) { res.cookie(AUTH_COOK, token, { maxAge: EXPIRATION_THRESHOLD, httpOnly: true }) }
  if (!authSessionObj) {
    throw Error('Session not found')
  }

  authSessionObj.expires = dateValue + EXPIRATION_THRESHOLD
  return dateValue
}

app.get('/auth-sessions', (req, res) => {
  let output = 'auth-sessions\n'
  for (const [ key, value ] of authSessionMap.entries()) {
    output += `${key}: ${value.expires}, ${value.client ? 'client connected' : ''}, id: ${value.id ? value.id : ''}\n`
  }
  output += '\naccount-auths\n'
  for (const [ key, value ] of accountAuthMap.entries()) {
    output += `${key}: ${value ? 'client connected' : ''}`
  }
  res.status(200).write(output, () => { res.end() })
})

app.get('/account', useAuth(async (req, res, auth) => {
  const { id } = auth 
  const account = await getAccount({ id, withSessionInfo: true })
  if (!account) {
    res.status(404).json({ success: false, errors: [ 'Account not found' ]})
    return
  }

  /* don't pass the hash down to the client */
  delete account.hash
  res.status(200).json({ success: true, account: account })  
}))

/* 
 * this function does NOT require auth -- in fact, it MUST NOT in order to
 * allow anyone to create a new account
 */
const validateEmail = email => {
  if (!email) { throw new Error('email must not be empty') }
  email = email.trim() 
  if (!email) { throw new Error('email must not be blank') }
  if (!/^\w[^@]+@[^.]+\.\w+/.test(email)) { throw new Error('email is invalid') }
}

const validateHash = hash => {
  if (!hash) { throw new Error('hash must not be empty') }
  try {
    Buffer.from(hash, 'base64')
  } catch (err) {
    throw new Error('hash is not valid base64')
  }
}

app.post('/account', async (req, res) => {
  if (!db) {
    res.status(404).json({ success: false, errors: [ 'Database not found' ] })
    return
  }

  const { email, hash, nickname } = req.body

  const errors = []
  try { validateEmail(email) } catch (err) { if (err) errors.push(err.message) }
  try { validateHash(hash) } catch (err) { if (err) errors.push(err.message) }
  if (errors.length) {
    res.status(400).json({ success: false, errors })
    return
  }

  try { 
    const accountResult = await createAccount({ email, hash, nickname })
    res.status(200).json({ success: true, account: accountResult })
  } catch (err) {
    res.status(500).json({ success: false, errors: [ err.message ] })
    return
  }

})

app.post('/accounts/search', useAuth(async (req, res, auth) => {
  res.status(200).json({ success: true, accounts: [] })
}))

app.post('/accounts/search/:searchQuery', useAuth(async (req, res, auth) => {
  if (!db) { throw new Error('Database not found') }

  const searchQuery = req.params.searchQuery
  const accounts = db.collection('accounts')
  let accountMatches = await accounts.find({
    $or: [
      { nickname: { $regex: searchQuery }},
      { email: { $regex: searchQuery }}
    ]
  }).toArray()
  res.status(200).json({ success: true, accounts: accountMatches || [] })  
}))

app.get('/accounts/friend/request', useAuth(async (req, res, auth) => {
  const { id } = auth
  const friendRequestAccounts = await db.collection('accounts').find({
    friends: {
      $elemMatch: {
        _id: new ObjectID(id),
        pending: true
      }
    }
  }).toArray()
  friendRequestAccounts.forEach(account => delete account.hash)
  res.status(200).json({ success: true, friendRequests: friendRequestAccounts || [] })
}))

app.post('/accounts/friend/request', useAuth(async (req, res, auth) => {
  const { id } = auth
  const targetFriend = req.body
  const account = await getAccount({ id })
  
  if (!account) {
    res.status(404).json({ success: false, errors: [ 'Account not found' ]})
    return
  }

  targetFriend._id = new ObjectID(targetFriend._id)

  await db.collection('accounts').update(
    {
      _id: new ObjectID(id)
    },
    {
      $push: {
        friends: targetFriend
      }
    }
  )
  res.status(200).json({ success: true })
}))

app.delete('/accounts/friend', useAuth(async (req, res, auth) => {
  const { id } = auth
  const targetFriend = req.body
  const account = await getAccount({ id })
  
  if (!account) {
    res.status(404).json({ success: false, errors: [ 'Account not found' ]})
    return
  }

  targetFriend._id = new ObjectID(targetFriend._id)

  await db.collection('accounts').update(
    {
      _id: new ObjectID(id)
    },
    {
      $pull: {
        friends: {
          _id: targetFriend._id,
          nickname: targetFriend.nickname
        }
      }
    }
  )
  res.status(200).json({ success: true })
}))

/* this one also requires auth to be disabled for validation */
app.post('/account/available', async (req, res) => {

  let { email } = req.body
  
  if (!email) {
    res.status(404).json({ success: false, errors: [ 'email must not be empty' ] })
    return
  }
  email = email.trim()
  if (!email) {
    res.status(400).json({ success: false, errors: [ 'email must not be blank' ] })
  }

  const accounts = db.collection('accounts')

  try {
    const account = await accounts.findOne({ email })

    if (!account) {
      res.status(200).json({ success: true })
      return
    } else {
      res.status(302).json({ success: false })
    }
  } catch (err) {
    res.status(500).json({ success: false, errors: [ err.message ] })
  }

})

app.post('/account/sessions', useAuth(async (req, res, auth) => {
  const { id } = auth
  const account = await getAccount({ id })
  if (!account) {
    res.status(404).json({ success: false, errors: [ 'Account not found' ]})
    return
  }

  const { sessionIds = [] } = account.sessions

  const sessions = []
  res.status(200).json({ success: true, sessions })  
}))

app.post('/account/settings', useAuth(async (req, res, auth) => {
  const errors = []
  const { id } = auth
  const account = await getAccount({ id })
  const { email, nickname, currentHash, newHash } = req.body
  if (email !== account.email || newHash) {
    if (!currentHash) {
      errors.push('Current password is required')
    } else if (currentHash !== account.hash) {
      errors.push('Current password is invalid')
    }
  }  
  if (!nickname) {
    errors.push('Nickname cannot be blank')
  }
  try { validateEmail(email) } catch (err) { if (err) errors.push(err.message) }
  if (newHash) {
    try { validateHash(newHash) } catch (err) { if (err) errors.push(err.message) }
  }
  if (errors.length) {
    res.status(400).json({ success: false, errors })
    return
  }
  await db.collection('accounts').update(
    {
      _id: new ObjectID(id)
    },
    {
      $set: {
        email: email,
        nickname: nickname,
        hash: newHash || account.hash
      }
    }
  )

  res.status(200).json({ success: true })
}))



app.post('/account/avatar', useAuth(async (req, res, auth) => {
  const { id } = auth
 
  const contentType = req.headers['content-type']
  if (contentType?.split(';')[0].split('/')[0] !== 'image') {
    res.status(500).json({ success: false, errors: [ 'File type must be an image' ] })
    return
  }
  const avatarId = new ObjectID()
  await uploadMongoFile({
    bucketName: 'avatars',
    fileId: avatarId,
    fileName: `avatarImage_${Date.now()}`,
    contentType: contentType,
    inputStream: req 
  })
  await db.collection('accounts').update(
    {
      _id: new ObjectID(id)
    },
    {
      $set: {
        avatarId: avatarId
      }
    }
  )
  res.status(200).json({ avatarId: avatarId.toHexString() })
}))

function uploadMongoFile({ bucketName, fileId, fileName, contentType, inputStream }) {
  return new Promise((resolve, reject) => {
    try {
      const bucketWriteStream = new GridFSBucket(db, { bucketName }).openUploadStreamWithId(fileId, fileName, { contentType })
      bucketWriteStream.on('finish', resolve)      
      bucketWriteStream.on('error', reject)
      inputStream.pipe(bucketWriteStream)
    } catch (err) {
      reject(Error('file not found definitely'))     
    }
  })
}

function downloadMongoFile({ bucketName, fileId, outputStream }) {
  try {
    const bucketReadStream = new GridFSBucket(db, { bucketName }).openDownloadStream(fileId)
    bucketReadStream.pipe(outputStream)
  } catch (err) {
    throw Error('file found definitely')
  }
}

app.get('/avatars/:avatarId', useAuth(async (req, res) => {
  try {
    const avatarId = new ObjectID(req.params.avatarId)
    const fileData = await db.collection('avatars.files')?.findOne({
      _id: avatarId
    })
    res.writeHead(200, {
      'Content-Type': fileData.contentType
    })
    downloadMongoFile({
      bucketName: 'avatars',
      fileId: avatarId,
      outputStream: res
    }) 
  } catch (err) {
    res.status(404).end()
  }
}))


app.get('/bounce', (req, res) => {
  try {
    res.json({ success: true, token: checkAuth({ req, res }).token })
    return 
  } catch (err) {
    res.status(400).json({ success: false, errors: [ err.message ] })
  }
})

/* 
 * this function does not use useAuth because errors MUST be ignored for
 * correct functionality
 */
app.post('/auth', async (req, res) => {

  const { email, hash } = req.body

  /* check for auth-token cookie */
  try {
    const { token, id } = checkAuth({ req, res })
    res.json({ success: true, token, id })
    return 
  } catch (err) {
    /* do nothing */
  }

  const errors = []
  if (!email) errors.push('e-mail was not specified')
  if (!hash) errors.push('e-mail and password are both required')

  let account = {}
  if (!errors.length) {
    try {
      account = await validateLogin(email, hash)
    } catch (err) {
      errors.push(err.message)
    }
  }

  if (errors.length) {
    res.status(401).json({
      errors,
      success: false
    })
    return
  }

  const token = generateSessionToken(account._id.toString())

  res.cookie(AUTH_COOK, token, { maxAge: EXPIRATION_THRESHOLD, httpOnly: true })

  res.json({ success: true, token, id: account._id })
})

app.get('/unauth', useAuth((req, res, auth) => {
  const { token } = auth 
  if (token) {
    const authSessionObj = authSessionMap.get(token) 
    const sendString = JSON.stringify({ expired: true, loggedOff: true })
    authSessionObj?.client?.send(`ses:-1:${sendString}`)
    authSessionMap.delete(token)
    if (authSessionObj.id) { accountAuthMap.delete(authSessionObj.id) }
    res.status(200).json({ success: true })
    return 
  }

  res.status(410).json({ success: false, errors: [ 'Invalid token' ] })
}))

function handleSocketResponse(mId, res, containerId) {
  const { connectedAccounts = [] } = res
  res.sessionId = containerId

  for (const connectedAccount of connectedAccounts) {
    const token = accountAuthMap.get(connectedAccount)
    const authSessionObj = authSessionMap.get(token)
    if (authSessionObj?.client) {
      authSessionObj.client.send(`jam:${mId}:${JSON.stringify(res)}`) 
    }
  }
}

app.put('/session/create', useAuth(async (req, res, auth) => {
  const { id, token } = auth 

  const {
    title,
    description = '',
    sessionLength,
    bpm,
    pattern,
    measures
  } = req.body

  if (!title) { 
    res.status(400).json({ success: false, errors: [ 'A title must be specified for the session' ] })
    return 
  }

  try {
    const sessionInfo = await sessionOps.createSession({ 
      title,
      description,
      accountId: id,
      token,
      sessionLength,
      bpm,
      measures,
      pattern
    })
    res.status(200).json({ success: true, ...sessionInfo })
  } catch (err) {
    res.status(400).json({ success: false, errors: [ err.message ] })
  }
}))

app.post('/session/find', useAuth(async (req, res, auth) => {
  const { id } = auth
  const { name } = req.body

  try {
    const results = await sessionOps.findSessions({ name, accountId: id })
    res.status(200).json({ success: true, sessions: results })
  } catch (err) {
    res.status(400).json({ success: false, errors: [ err.message ] })
  }
}))

app.put('/session/join', useAuth(async (req, res, auth) => {
  const { id } = auth
  const { sessionId } = req.body

  if (!sessionId) { 
    res.status(400).json({ success: false, errors: [ 'A session ID is required in order to join a session' ] })
    return 
  }

  try {
    sessionOps.joinSession({ sessionId, accountId: id })
    res.status(200).json({ success: true })
  } catch (err) {
    res.status(400).json({ success: false, errors: [ err.message ] })
  }
}))

app.get('/sessions/purge-all', async (req, res) => {
  try {
    await sessionOps.purgeSessions()
    for (const value of authSessionMap.values()) {
      if (value.client) { messageClient(value.client, `jam:-1:${JSON.stringify({ purgeSessions: true })}`) }
    }
    res.status(200).json({ success: true })
  } catch (err) {
    res.status(400).json({ success: false, errors: [ err.message ] })
  }
})

app.get('/sessions', (req, res) => {
  let output = ''
  for (const [ key, value ] of sessionOps.getSessions()) {
    output += `${key}: ${value ? 'socket connected' : ''}\n`
  }
  res.status(200).write(output, () => { res.end() })
})

app.post('/sessions/:sessionId/stream/upload', useAuth(async (req, res, auth) => {
  if (!sessionOps) {
    res.status(500).json({ success: false, errors: [ 'session ops unavailable' ] })
    return
  }

  /* Key-value pairs of header names and values. Header names are lower-cased. */
  const contentType = req.headers['content-type']
  const fileType = contentType?.split(';')[0].split('/')[1]
  if (!fileType) {
    res.status(410).json({ success: false, errors: [ 'invalid file type supplied' ] })
    return
  }

  const fileId = req.query.fileId || generateRandomBitString(12, 'hex')

  const result = await sessionOps.uploadFile({
    sessionId: req.params.sessionId,
    fileId,
    fileType,
    length: 0,
    account: auth.id,
    readStream: req
  })

  if (result !== fileId) {
    /* this is a pretty interesting case here */
    res.status(500).json({ success: false, errors: [ 'what did you do? :(' ] })
    return
  }

  res.status(200).json({ success: true, fileId })
}))

app.get('/sessions/:sessionId/stream/download/:fileId', useAuth(async (req, res) => {
  if (!sessionOps) {
    res.status(500).json({ success: false, errors: [ 'session ops unavailable' ] })
    return
  }

  const fileId = req.params.fileId

  if (!fileId) {
    res.status(410).json({ success: false, errors: [ 'fileId must be specified' ] })
    return
  }

  sessionOps.downloadFile({
    sessionId: req.params.sessionId,
    fileId,
    writeStream: res
  })

}))

app.get('/metro/pings/:pingName', useAuth(async (req, res) => {
  const pingName = req.params.pingName.replace(/[^\w-]/g, '')
  try { 
    const resolvedPath = path.resolve(`./session/${pingName}.raw`)
    await fsp.stat(resolvedPath)
    const readStream = fs.createReadStream(resolvedPath)
    res.writeHead(200, {
      'Content-Type': 'application/pcm_s24le'
    })
    readStream.pipe(res)
  } catch (err) { 
    res.status(404).end()
  }
}))


async function begin() {

  try {
    await mongoClient.connect()
    console.log('Connected successfully to server')

    db = mongoClient.db(MONGO_DB_NAME)
    sessionOps = new SessionOps({ db, responseHandler: handleSocketResponse })
  } catch (err) {
    /* do nothing */
    console.dir(err)
  }

  sessionOps.reconnect()

  app.listen(PORT, () => { 
    console.log(`server running on port: ${PORT}`) /* do nothing */ 
  })
}

begin()
