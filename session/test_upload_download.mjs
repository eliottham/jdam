import fs from 'fs'
import net from 'net'
import { exec } from 'child_process'
import { paramParse } from 'jdam-utils'

const FILE_ID = 'test_file'
const FILE_TYPE = 'flac'
const LENGTH = 0
const IP = '127.0.0.1'

function uploadFile() {

  return new Promise((resolve, reject) => {
    const readStream = fs.createReadStream('./duck_sample.flac')

    /* 25053 is the port for file streaming */
    const client = net.createConnection({ host: IP, port: 25053 }, () => {
      client.write(`action=upload,fileType=${FILE_TYPE},fileId=${FILE_ID},length=${LENGTH};`)
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
      resolve(FILE_ID) 
    })
  })
}

function downloadFile() {

  return new Promise((resolve, reject) => {
    const writeStream = fs.createWriteStream('./duck_sample_downloaded.flac')

    /* 25053 is the port for file streaming */
    const client = net.createConnection({ host: IP, port: 25053 }, () => {
      client.write(`action=download,fileId=${FILE_ID};`)

      client.once('data', data => {
        const dataParams = paramParse(data)

        console.dir(dataParams)

        client.pipe(writeStream)
      })
      client.on('error', reject)
      client.on('close', resolve)
    })
  })
}

async function test() {
  const createContainer = () => {
    return new Promise((resolve, reject) => {
      /* 
       *  -d means detach mode
       *  check if not on linux and publish to a port for testing, this isn't an issue on linux,
       *  where the docker network controller can properly create a new subnet
       *  --rm means remove the container when the process exits
       */
      const pattern = [ 2, 1, 1, 1 ]
      try {
        exec([ 'docker run',
          '--network=jdam-net',
          `-d ${process.platform !== 'linux' ? '-p 25052:25052 -p 25053:25053 -p 9230:9230' : ''}`,
          `${process.platform !== 'linux' ? '' : '--add-host=host.docker.internal:host-gateway'}`,
          // '--rm',
          `-e TITLE="Test Session"`,
          `-e DESCRIPTION="Test uploading and downloading sound file"`,
          `-e SESSION_LENGTH=120`,
          `-e BPM=120`,
          `-e MEASURES=4`,
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

  /*
  const containerId = await createContainer()
  console.log(containerId)
  */

  try {
    console.log('uploading file')
    console.log(await uploadFile())

    console.log('downloading file')
    console.log(await downloadFile())
  } catch (err) {
    console.log(err)
  }

  /*
  exec(`docker stop ${containerId}`)
  exec(`docker rm ${containerId}`)
  */
}

test()
