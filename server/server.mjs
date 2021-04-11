import Express from 'express'
import cookieParser from 'cookie-parser'
import crypto from 'crypto'
import WS from 'express-ws'
import WebSocket from 'ws'
import { exec } from 'child_process'
import SessionOps from './session_ops.mjs'
import Mongo from 'mongodb'
import net from 'net'
const { MongoClient, ObjectID } = Mongo

const PORT = 54049
const MONGO_URL = 'mongodb://localhost:27017'
const MONGO_DB_NAME = 'jdam'
const NO_DOCKER = process.env.NO_DOCKER === 'true' ?  true : false

const mongoClient = new MongoClient(MONGO_URL, { useUnifiedTopology: true })
let db
let sessionOps

const AUTH_COOK = 'auth-token'
const EXPIRATION_THRESHOLD = (10 * 60 * 1000) /* 10 minutes in ms */


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

app.ws('/ws', ws => {
  ws.send('connected')
  ws.on('message', msg => {
    if (typeof msg === 'string') {
      const prefix = msg.split(':')[0]
      const data = msg.slice(prefix.length + 1)
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

          sessionOps.write(sessionId, data)

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
        if (value.client) { messageClient(value.client, `ses:${JSON.stringify({ expired: true })}`) }
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

  /* look through profiles to find one matching the email */
  const profile = await getAccount({ email }) 

  if (!profile) {
    throw new Error('Account not found')
  }

  if (profile.hash !== hash) {
    throw new Error('Credentials are invalid')
  }

  return profile
}

async function createAccount({ email, hash, nickname }) {
  if (!db) { throw new Error('Database not found') }

  try {
    const profiles = db.collection('profiles')
    const { upsertedId } = await profiles.updateOne(
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

  const profiles = db.collection('profiles')
  let profile
  if (id) {
    profile = await profiles.findOne({ _id: new ObjectID(id) })
  } else if (hash) {
    profile = await profiles.findOne({ hash })
  } else if (email) {
    profile = await profiles.findOne({ email })
  }

  return profile
}

/* this should probably be something like a JWT */
function generateSessionToken(withAccountId) {
  const byteBuffer = Buffer.allocUnsafe(24) 
  crypto.randomFillSync(byteBuffer)
  const date = new Date()
  const b64 = byteBuffer.toString('base64')
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
  const profile = await getAccount({ id })
  if (!profile) {
    res.status(404).json({ success: false, errors: [ 'Account not found' ]})
    return
  }

  /* don't pass the hash down to the client */
  delete profile.hash
  res.status(200).json({ success: true, account: profile })  
}))

/* 
 * this function does NOT require auth -- in fact, it MUST NOT in order to
 * allow anyone to create a new account
 */
app.post('/account', async (req, res) => {
  if (!db) {
    res.status(404).json({ success: false, errors: [ 'Database not found' ] })
    return
  }

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

  const profiles = db.collection('profiles')

  try {
    const profile = await profiles.findOne({ email })

    if (!profile) {
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
  const profile = await getAccount({ id })
  if (!profile) {
    res.status(404).json({ success: false, errors: [ 'Account not found' ]})
    return
  }

  const { sessionIds = [] } = profile.sessions

  const sessions = []
  res.status(200).json({ success: true, sessions })  
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

  let profile = {}
  if (!errors.length) {
    try {
      profile = await validateLogin(email, hash)
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

  const token = generateSessionToken(profile._id.toString())

  res.cookie(AUTH_COOK, token, { maxAge: EXPIRATION_THRESHOLD, httpOnly: true })

  res.json({ success: true, token, id: profile._id })
})

app.get('/unauth', useAuth((req, res, auth) => {
  const { token } = auth 
  if (token) {
    const authSessionObj = authSessionMap.get(token) 
    const sendString = JSON.stringify({ expired: true, loggedOff: true })
    authSessionObj?.client?.send(`ses:${sendString}`)
    authSessionMap.delete(token)
    if (authSessionObj.id) { accountAuthMap.delete(authSessionObj.id) }
    res.status(200).json({ success: true })
    return 
  }

  res.status(410).json({ success: false, errors: [ 'Invalid token' ] })
}))

function handleSocketResponse(res, containerId) {
  const { connectedAccounts = [] } = res
  res.sessionId = containerId

  for (const connectedAccount of connectedAccounts) {
    const token = accountAuthMap.get(connectedAccount)
    const authSessionObj = authSessionMap.get(token)
    if (authSessionObj.client) {
      authSessionObj.client.send('jam:' + JSON.stringify(res)) 
    }
  }
}

app.put('/session/create', useAuth(async (req, res, auth) => {
  const { id, token } = auth 

  const { name } = req.body

  if (!name) { 
    res.status(400).json({ success: false, errors: [ 'A name must be specified for the session' ] })
    return 
  }

  try {
    const sessionInfo = await sessionOps.createSession({ sessionName: name, accountId: id, token })
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
  const { id, token } = auth

  const { sessionId } = req.body
  if (!sessionId) { 
    res.status(400).json({ success: false, errors: [ 'A name must be specified for the session' ] })
    return 
  }

  try {
    sessionOps.joinSession({ sessionId, accountId: id })
    res.status(200).json({ success: true })
  } catch (err) {
    res.status(400).json({ success: false, errors: [ err.message ] })
  }
}))

app.get('/sessions', (req, res) => {
  let output = ''
  for (const [ key, value ] of sessionOps.getSessions()) {
    output += `${key}: ${value ? 'socket connected' : ''}\n`
  }
  res.status(200).write(output, () => { res.end() })
})

async function begin() {

  /* eliminate any running docker containers for jdam/test */
  exec('bash -c "docker rm -f $(docker ps -aq -f ancestor=jdam/test)"')

  try {
    await mongoClient.connect()
    console.log('Connected successfully to server')

    db = mongoClient.db(MONGO_DB_NAME)
    sessionOps = new SessionOps({ db, responseHandler: handleSocketResponse })
  } catch (err) {
    /* do nothing */
    console.dir(err)
  }

  app.listen(PORT, () => { 
    console.log(`server running on port: ${PORT}`) /* do nothing */ 
  })
}

begin()
