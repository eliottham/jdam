import net from 'net'
import { exec } from 'child_process'
import Mongo from 'mongodb'
const { ObjectID } = Mongo

const NO_DOCKER = process.env.NO_DOCKER === 'true' ?  true : false
const PORT = 25051

/*
 * track the active jam session container ip's for forwarding requests
 *
 * each one will be a uuid mapped to an IP addr
 */

const sessionMap = new Map()

const pendingSessions = new Map()

/* 
 * this is necessary in order to know when a session container has been fully
 * started. Otherwise the client socket connects before the other side
 * opens, and then instantly terminates.
 */
const sessionListener = net.createServer(socket => {
  socket.once('data', data => {
    try {
      const sessionId = data.toString('utf8')
      const pendingSession = pendingSessions.get(sessionId)
      socket.end()

      if (!pendingSession) { return }
      const { accountId, ip, rh } = pendingSession
      pendingSessions.delete(sessionId)

      const client = net.createConnection({ host: ip, port: 25052 }, () => { 
        client.write(JSON.stringify({ req : { addAccount: accountId }}), () =>{
          client.on('data', data => {
            try {
              const json = JSON.parse(data)
              const { res } = json
              if (res) { rh(res, sessionId) }
            } catch (err) {
              console.dir(err)
            }
          })
          client.on('end', () => {
            /* TODO: resolve duplicate code */
            try {
              sessionMap.delete(sessionId)
            } catch (err) {
              console.dir(err)
            }
          })
          client.on('error', () => { 
            sessionMap.delete(sessionId)
          })
        })
        sessionMap.set(sessionId, socket)

      })
    } catch (err) {
      /* do nothing */
    }
  })

})

class SessionOps {
  constructor({ db, responseHandler = () => {} }) {
    this.db = db
    this.responseHandler = responseHandler
  }

  /* data is a string or buffer */
  write(sessionId, data) {
    const socket = sessionMap.get(sessionId)
    if (socket) { socket.write(data) }
  }

  getSessions() {
    return Array.from(sessionMap)
  }

  async createSession({ sessionName, accountId, sessionLength = 1 }) {
    /* 
     * absolutely make sure to sanitize the sessionName before sending it to exec 
     * only allow word characters, spaces, dashes in the session name and NOTHING ELSE
     *
     * it should also be sanitized before even leaving the browser, but just be sure
     */
    if (!this.db) { throw new Error('Database not found') }

    sessionName = sessionName.replace(/[^\w -]/g, '')

    /* start a new session container and return the container id */
    const createContainer = () => {
      return new Promise((resolve, reject) => {
        /* 
         *  -d means detach mode
         *  check if not on linux and publish to a port for testing, this isn't an issue on linux,
         *  where the docker network controller can properly create a new subnet
         *  --rm means remove the container when the process exits
         */
        try {
          exec([ 'docker run',
            '--network=jdam-net',
            `-d ${process.platform !== 'linux' ? '-p 25052:25052' : ''}`,
            `${process.platform !== 'linux' ? '' : '--add-host=host.docker.internal:host-gateway'}`,
            /* '--rm', */
            `-e NAME="${sessionName}"`,
            `-e SESSION_LENGTH=${sessionLength}`,
            'jdam/test' ].join(' '), (error, stdout, stderr) => {
            if (error) { reject(error); return }
            if (stderr.length) { reject(stderr); return }
            /* 
             * docker only ever uses a length of 12 here so that should be good-enough
             * that way mongo can pull with an exact match rather than some 
             * other starts-with match
             */
            resolve(stdout.slice(0, 12))
          })
        } catch (err) {
          reject(err)
        }
      })
    }

    /* attempt to get session container's for it's IP address */
    const getIp = (container) => {
      return new Promise((resolve, reject) => {
        try {
          exec(`docker inspect -f docker inspect -f='{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' ${container}`, (error, stdout, stderr) => {
            if (error) { reject(error); return }
            if (stderr.length) { reject(stderr); return }
            resolve(stdout)
          })
        } catch (err) {
          reject(err)
        }
      })
    }

    const containerId = NO_DOCKER ? 'local-debug0' : await createContainer()

    /* on non-linux systems force the ip to localhost/127.0.0.1 */
    let ip = process.platform !== 'linux' ? '127.0.0.1' : ''
    /* try to get IP for the next five seconds */
    for (let a = 0; a < 10 && !ip; a++) {
      try {
        ip = await getIp(containerId)
      } catch (err) {
        /* do nothing */
      }
    }

    if (!ip) {
      throw Error('container ip was unable to be obtained')
    }

    /* add the containerId to the account's session array in mongodb */
    const accounts = this.db.collection('accounts')
    await accounts.updateOne(
      { _id: ObjectID(accountId) },
      { '$addToSet': { sessions: containerId }}
    )

    /* TODO: create a session record in the db for this session */

    const sessions = this.db.collection('sessions')
    await sessions.insertOne(
      {
        _id: containerId,
        name: sessionName,
        start: Date.now(),
        length: sessionLength * 60 * 1000, /* I am 100% going to regret/forget making this ms */
        ip,
        accounts: [ ObjectID(accountId) ]
      }
    )

    pendingSessions.set(containerId, { accountId, ip, rh: this.responseHandler })

    return { sessionId: containerId, name: sessionName, length: sessionLength }
  }

  joinSession({ sessionId, accountId }) {
    const sessionObj = sessionMap.get(sessionId)
    if (!sessionObj) { return }

    const socket = sessionObj
    socket.write(JSON.stringify({ req : { addAccount: accountId }}))
  }

  leaveSession({ sessionId, accountId }) {
    const sessionObj = sessionMap.get(sessionId)
    if (!sessionObj) { return }

    const socket = sessionObj
    socket.write(JSON.stringify({ req : { deleteAccount: accountId }}))
  }

  endSession(sessionId) {
    const sessionObj = sessionMap.get(sessionId)
    if (!sessionObj) { return }

    const socket = sessionObj
    socket.write(JSON.stringify({ req : { endSession: true }}))
  }

  /* find session(s) by name, accountId, or both */
  async findSessions({ name, accountId }) {

    if (!this.db) { throw new Error('Database not found') }

    const sessions = this.db.collection('sessions')
    
    const results = await sessions.find({
      name,
      ...accountId && { accounts: accountId }
    })

    return results
  }
}

sessionListener.listen(PORT, () => {
  console.log(`session listener running on port: ${PORT}`) /* do nothing */ 
})

export default SessionOps
