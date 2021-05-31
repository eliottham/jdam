import path from 'path'
import fs from 'fs'
import { URL } from 'url'
import http from 'http'

const url = new URL('http://localhost:48000/trim?start=200&end=700')
const req = http.request(url.toString(), {
  method: 'POST',
  headers: {
    'Content-Type': 'audio/wav'
  }
}, res => {
  const writeStream = fs.createWriteStream(path.resolve('./test.flac'))
  res.pipe(writeStream)
})

const readStream = fs.createReadStream(path.resolve('./tom_12_69.wav'))
readStream.pipe(req)

