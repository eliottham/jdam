import net from 'net'
import { exec } from 'child_process'
import Mongo from 'mongodb'
import { paramParse } from 'jdam-utils'
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

const separator = ':'.charCodeAt()

async function onSessionDisconnect({
  db,
  sessionId,
  responseHandler
}) {
  sessionMap.delete(sessionId)
  console.log(`closed ${sessionId}`)

  /* get accounts with a reference to the sessionId */
  const accounts = db.collection('accounts')

  /* 
   * also have to update all accounts to pull this container
   * from their sessions list
   */

  const cursor = accounts.find(
    { sessions: sessionId }
  )
  
  const affectedAccounts = []
  await cursor.forEach(account => {
    affectedAccounts.push(account._id.toString())
  })

  await accounts.updateMany(
    { sessions: sessionId },
    { '$pull': { sessions: sessionId }}
  )

  const res = {
    res: {
      connectedAccounts: affectedAccounts,
      closeSession: true
    }
  }
  responseHandler('-1', res, sessionId) 

}

const sessionListener = net.createServer(socket => {
  socket.once('data', data => {
    try {
      const sessionId = data.toString('utf8')
      const pendingSession = pendingSessions.get(sessionId)
      socket.end()

      if (!pendingSession) { return }
      const { accountId, ip, responseHandler } = pendingSession
      pendingSessions.delete(sessionId)

      const client = net.createConnection({ host: ip, port: 25052 }, () => { 

        client.on('data', data => {
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
            const { res } = json

            /* set owner account for reference later */
            res.ownerAccount = accountId

            /* response handler */
            if (res) { responseHandler(mId, res, sessionId) }
          } catch (err) {
            console.dir(err)
          }
        })
        client.on('close', () => {
          /* TODO: resolve duplicate code */
          try {
            onSessionDisconnect({
              db: pendingSession.db,
              sessionId,
              responseHandler: responseHandler
            })
          } catch (err) {
            console.dir(err)
          }
        })
        client.on('error', () => { 
          sessionMap.delete(sessionId)
        })

        /* send the pending session a request */
        client.write('-1:' + JSON.stringify({ req : { addAccount: accountId }}))
        sessionMap.set(sessionId, client)

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
  write(sessionId, mId, data) {
    const socket = sessionMap.get(sessionId)
    if (!socket) { return }

    if (socket) { socket.write(`${mId}:${data}`) }
  }

  getSessions() {
    return Array.from(sessionMap)
  }

  async createSession({
    title,
    description,
    accountId,
    sessionLength = 1,
    bpm,
    measures,
    pattern 
  }) {
    /* 
     * absolutely make sure to sanitize the title and description before sending them to exec 
     * only allow word characters, spaces, dashes in the session name and NOTHING ELSE
     *
     * it should also be sanitized before even leaving the browser, but just be sure
     */
    if (!this.db) { throw Error('Database not found') }

    title = title.replace(/[^\w -]/g, '')
    description = description.replace(/[^\w -]/g, '')

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
            `-d ${process.platform !== 'linux' ? '-p 25052:25052 -p 25053:25053 -p 9230:9230' : ''}`,
            `${process.platform !== 'linux' ? '' : '--add-host=host.docker.internal:host-gateway'}`,
            // '--rm',
            `-e TITLE="${title}"`,
            `-e DESCRIPTION="${description}"`,
            `-e SESSION_LENGTH=${sessionLength}`,
            `-e BPM=${bpm}`,
            `-e MEASURES=${measures}`,
            `-e PATTERN=${process.platform !== 'linux' ? '"' + JSON.stringify(pattern) + '"' : "'" + JSON.stringify(pattern) + "'" }`,
            'jdam/session' ].join(' '), (error, stdout, stderr) => {
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

    const sessions = this.db.collection('sessions')
    await sessions.insertOne(
      {
        _id: containerId,
        title,
        description,
        start: Date.now(),
        length: sessionLength * 60 * 1000, /* I am 100% going to regret/forget making this ms */
        ip,
        accounts: [ ObjectID(accountId) ],
        ownerAccount: ObjectID(accountId)
      }
    )

    pendingSessions.set(containerId, { accountId, db: this.db, ip, responseHandler: this.responseHandler })

    /* attempt to remove after 10 seconds always. This may be a noop */
    setTimeout(() => {
      pendingSessions.delete(containerId)
    }, 10000)

    return { sessionId: containerId, title, description, length: sessionLength }
  }

  async joinSession({ sessionId, accountId }) {
    const session = await this.db.collection('sessions').findOne({
      _id: sessionId
    })
    if (!session) { throw Error('session not found') }
    this.write(sessionId, -1, JSON.stringify({ req : { addAccount: accountId }}))
    return session
  }

  async leaveSession({ sessionId, accountId }) {
    const session = await this.db.collection('sessions').findOne({
      _id: sessionId
    })
    if (!session) { throw Error('session not found') }
    this.write(sessionId, -1, JSON.stringify({ req : { deleteAccount: accountId }}))
    return session
  }

  async endSession(sessionId) {
    const session = await this.db.collection('sessions').findOne({
      _id: sessionId
    })
    if (!session) { throw Error('session not found') }
    this.write(sessionId, -1, JSON.stringify({ req : { endSession: true }}))
    return session
  }

  /* find session(s) by name, accountId, or both */
  async findSessions({ title, sessionId, accountId }) {

    if (!this.db) { throw Error('Database not found') }

    const sessions = this.db.collection('sessions')
    
    const results = await sessions.find({
      ...title && { title },
      ...sessionId && { _id: sessionId },
      ...accountId && { accounts: accountId }
    }, { 
      /* 
       * TODO: remove limit... but let's be honest, why are you leafing through
       * like 900 sessions anyway?
       */
      limit: 10
    })

    return await results.toArray()
  }

  async purgeSessions() {
    exec('bash -c "docker rm -f $(docker ps -aq -f ancestor=jdam/session)"')
    const accounts = this.db.collection('accounts')
    
    try {
      const sessions = this.db.collection('sessions')
      await sessions.drop()
    } catch (err) {
      /* this will fail if 'sessions' is not found */
    }
    await accounts.updateMany(
      { },
      { '$set': { sessions: [] }}
    )
    sessionMap.clear()
  }

  reconnect() {

    /* 
     * get sessions from the mongodb
     *
     * we may want to corroborate with what we get back from scanning through
     * the list of runnning docker processes... but in a super-scaled setup
     * that may also be infeasible
     */

    if (!this.db) { throw Error('Database not found') }

    const sessions = this.db.collection('sessions')
    const accounts = this.db.collection('accounts')
    const cursor = sessions.find()

    cursor.forEach(session => {
      const { _id: sessionId, ip, ownerAccount } = session
      const client = net.createConnection({ host: ip, port: 25052 })
      client.on('data', data => {
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
          const { res } = json

          /* set owner account for reference later */
          res.ownerAccount = ownerAccount.toString()

          if (res) { this.responseHandler(mId, res, sessionId) }
        } catch (err) {
          console.dir(err)
        }
      })
      client.on('close', () => {
        /* TODO: resolve duplicate code */
        try {
          onSessionDisconnect({
            db: this.db,
            sessionId,
            responseHandler: this.responseHandler
          })
        } catch (err) {
          console.dir(err)
        }
      })
      client.on('error', () => { 
        sessionMap.delete(sessionId)
        /* 
         * this means the session has terminated, but the database has an entry
         * for it. It should be deleted from the database
         */
        sessions.deleteOne({ _id: sessionId })

        /* 
         * also have to update all accounts to pull this container
         * from their sessions list
         */
        accounts.updateMany(
          { sessions: sessionId },
          { '$pull': { sessions: sessionId }}
        )
      })
      sessionMap.set(sessionId, client)
    })

  }

  async uploadFile({ sessionId, fileId, fileType, length, readStream }) {
    const sessions = this.db.collection('sessions')
    const session = await sessions.findOne({ _id: sessionId })
    if (!session) { throw Error('Session not found for sessionId') }

    const { ip } = session
    return new Promise((resolve, reject) => {

      /* 25053 is the port for file streaming */
      const client = net.createConnection({ host: ip, port: 25053 }, () => {
        client.write(`action=upload,fileType=${fileType},fileId=${fileId},length=${length};`)
        client.once('data', data => {
          const dataParams = paramParse(data)
          if (!dataParams) { 
            reject(Error('no data returned')) 
            return
          }

          const { error } = dataParams
          if (error) {
            reject(Error(error)) 
            return
          }

          readStream.pipe(client)
        })
      })
      client.on('error', reject)
      client.on('close', () => {
        resolve(fileId) 
      })
    })
  }

  async downloadFile({ sessionId, fileId, writeStream }) {
    const sessions = this.db.collection('sessions')
    const session = await sessions.findOne({ _id: sessionId })
    if (!session) { throw Error('Session not found for sessionId') }

    const { ip } = session
    /* 25053 is the port for file streaming */
    return new Promise((resolve, reject) => {
      const client = net.createConnection({ host: ip, port: 25053 }, () => {
        client.write(`action=download,fileId=${fileId};`)

        client.once('data', data => {
          const dataParams = paramParse(data)

          writeStream.write(JSON.stringify(dataParams), () => {
            client.pipe(writeStream)
          })
        })
        client.on('error', reject)
        client.on('close', resolve)
      })
    })
  }
}

sessionListener.listen(PORT, () => {
  console.log(`session listener running on port: ${PORT}`) /* do nothing */ 
})

export default SessionOps
