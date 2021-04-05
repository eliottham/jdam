import Express from 'express'
import cookieParser from 'cookie-parser'
import fs, { promises as fsp } from 'fs'
import crypto from 'crypto'
import WS from 'express-ws'
import WebSocket from 'ws'
import Mongo from 'mongodb'
const { MongoClient } = Mongo

const PORT = 54049
const MONGO_URL = 'mongodb://localhost:27017'
const MONGO_DB_NAME = 'jdam'

const mongoClient = new MongoClient(MONGO_URL, { useUnifiedTopology: true })
let db

const AUTH_COOK = 'auth-token'
const EXPIRATION_THRESHOLD = (10 * 60 * 1000) /* 10 minutes in ms */


/* new express app */
const appBase = Express()
const { app } = WS(appBase)
app.use(Express.static('public'))

/* remember to use the json body-parser */
app.use(Express.json())
app.use(cookieParser())

/* 
 * keep track of active sessions
 *
 * key is a token, value is a session obj
 * {
 *   expires: time in ms
 *   client: websocket client
 * }
 * new requests will refresh the expiration time
 */
const sessionMap = new Map()

app.ws('/', ws => {
  ws.send('connected')
  ws.on('message', msg => {
    if (typeof msg === 'string') {
      const prefix = msg.split(':')[0]
      const data = msg.slice(prefix.length + 1)
      switch (prefix) {
      case 'tok':
      {
        const session = data
        const sessionObj = sessionMap.get(session) 
        if (sessionObj) {
          sessionObj.client = ws
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
   * prune sessions every two minutes 
   */

  const now = Date.now()
  if ((now + 5000) % (60 * 2 * 1000) < 10000) {
    for (const [ key, value ] of sessionMap.entries()) {
      if (now > value.expires) {
        if (value.client) {
          messageClient(value.client, `ses:${JSON.stringify({ expired: true })}`)
        }
        sessionMap.delete(key)
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
async function validateLogin(hash) {
  if (!db) { throw new Error('Database not found') }

  const profiles = db.collection('profiles')

  /* look through profiles to find one matching the email */
  const profile = await getAccount({ hash }) 

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
    const { upsertedId, error } = await profiles.updateOne(
      { email },
      { '$setOnInsert': {email, hash, nickname }},
      { upsert: true }
    )
    if (error) {
      throw error 
    }
    return { _id: upsertedId._id, email, hash, nickname }
  } catch (errObject) {
    throw new Error('Account not created')
  }

}

async function getAccount({ hash, id }) {
  if (!db) { throw new Error('Database not found') }

  const profiles = db.collection('profiles')
  const profile = id ? await profiles.findOne({ _id: id }) : await profiles.findOne({ hash })

  return profile
}

/* this should probably be something like a JWT */
function generateSessionToken(withAccountId) {
  const byteBuffer = Buffer.allocUnsafe(24) 
  crypto.randomFillSync(byteBuffer)
  const date = new Date()
  const b64 = byteBuffer.toString('base64')
  sessionMap.set(b64, { expires: date.valueOf() + EXPIRATION_THRESHOLD, ...!!withAccountId && { id: withAccountId }})
  return b64
}

function checkSession(req, res) {

  if (req.cookies[AUTH_COOK]) {
    const token = req.cookies[AUTH_COOK]
    refreshSession(token, res)
    const dateValue = new Date().valueOf()
    const expirationValue = sessionMap.get(token)
    if (!expirationValue) {
      throw Error('Session not found')
    }

    if (dateValue > expirationValue.expires) {
      sessionMap.delete(token)
      throw Error('Session expired')
    }

    return { token, ...expirationValue }
  }
  
  throw Error('Session not present')

}

function refreshSession(token, res) {
  const dateValue = new Date().valueOf()
  const expirationValue = sessionMap.get(token)
  /* 
   * remember to also refresh the auth-cook on the client, so it doesn't expire
   * after refreshing
   */
  if (res) res.cookie(AUTH_COOK, token, { maxAge: EXPIRATION_THRESHOLD, httpOnly: true })
  if (!expirationValue) {
    throw Error('Session not found')
  }

  expirationValue.expires = dateValue + EXPIRATION_THRESHOLD
  return dateValue
}

app.get('/sessions', (req, res) => {
  let output = ''
  for (const [ key, value ] of sessionMap.entries()) {
    output += `${key}: ${value.expires} ${value.client ? 'client connected' : ''}, id: ${value.id ? value.id : ''}\n`
  }
  res.status(200).write(output, () => { res.end() })
})

app.get('/account', async (req, res) => {
  try {
    const { id } = checkSession(req, res)
    const profile = await getAccount({ id })
    if (!profile) {
      res.status(404).json({ success: false, errors: [ 'Account not found' ]})
      return
    }

    /* don't pass the hash down to the client */
    delete profile.hash
    res.status(200).json({ success: true, account: profile })  
  } catch (err) {
    res.status(410).json({ success: false, errors: [ err.message ] })
    return
  }
})

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

app.get('/bounce', (req, res) => {
  try {
    res.json({ success: true, token: checkSession(req, res).token })
    return 
  } catch (err) {
    res.status(400).json({ success: false, errors: [ err.message ] })
  }
})

app.post('/auth', async (req, res) => {
  const { email, hash } = req.body

  /* check for auth-token cookie */
  try {
    const { token, id } = checkSession(req, res)
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
      profile = await validateLogin(hash)
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

  const token = generateSessionToken(profile._id)

  res.cookie(AUTH_COOK, token, { maxAge: EXPIRATION_THRESHOLD, httpOnly: true })

  res.json({ success: true, token, id: profile._id })
})

app.get('/unauth', (req, res) => {
  try {
    const { token } = checkSession(req, res)
    if (token) {
      const sessionObj = sessionMap.get(token) 
      const sendString = JSON.stringify({ expired: true, loggedOff: true })
      sessionObj?.client?.send(`ses:${sendString}`)
      sessionMap.delete(token)
      res.status(200).json({ success: true })
      return 
    }
  } catch (err) {
    res.status(410).json({ success: false, errors: [ err.message ] })
    return
  }

  res.status(410).json({ success: false, errors: [ 'Invalid token' ] })
})

async function begin() {

  try {
    await mongoClient.connect()
    console.log('Connected successfully to server')

    db = mongoClient.db(MONGO_DB_NAME)
  } catch (err) {
    /* do nothing */
    console.dir(err)
  }

  app.listen(PORT, () => { 
    console.log(`server running on port: ${PORT}`) /* do nothing */ 
  })
}

begin()
