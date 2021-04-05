import Express from 'express'
import cookieParser from 'cookie-parser'
import fs, { promises as fsp } from 'fs'
import crypto from 'crypto'
import WS from 'express-ws'
import WebSocket from 'ws'

const PORT = 54049

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

async function begin() {
  app.listen(PORT, () => { 
    console.log(`server running on port: ${PORT}`) /* do nothing */ 
  })
}

begin()
