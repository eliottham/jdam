import path from 'path'
import fs from 'fs'
import { URL } from 'url'
import http from 'http'

const url = new URL('http://localhost:48000/peaks')
const req = http.request(url.toString(), {
  method: 'POST',
  headers: {
    'Content-Type': 'audio/flac'
  }
}, res => {
  const writeStream = fs.createWriteStream(path.resolve('./test.json'))
  res.pipe(writeStream)
})

const readStream = fs.createReadStream(path.resolve('./tom_12_69.flac'))
readStream.pipe(req)

