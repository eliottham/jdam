import http from 'http'
import { URL } from 'url'
import fs, { promises as fsp } from 'fs'
import { Writable } from 'stream'
import { generateRandomBitString } from 'jdam-utils'
import { stream } from './wave.mjs'
import path from 'path'
import mime from 'mime-types'

const PORT = 48000

function runFfmpeg(params) {
}

function peaks(params) {
  /* 
   * use the ffmpeg process to stream to PCM raw, then analyze the chunks
   * for the frame-local maximums/minimums
   *
   * sampleRate is independent of the conversion rate
   */
  const audioRate = 6000
  const sampleStep = 1000 / audioRate

  const {
    req,
    res,
    fileType,
    start,
    end 
  } = params

  const sampleRate = params.sampleRate || 100

  let globalMax = -Number.MAX_VALUE
  let globalMin = Number.MAX_VALUE

  let ms = 0

  const frames = []
  const frameSize = Math.floor(audioRate / sampleRate)
  const currentFrame = Buffer.allocUnsafe(frameSize)
  let currentSample = 0

  const minmax = (chunk) => {
    let min = Number.MAX_VALUE
    let max = -Number.MAX_VALUE
    for (const value of chunk) {
      const signedValue = value - 128
      min = Math.min(min, signedValue)
      max = Math.max(max, signedValue)
      ms += sampleStep
    }
    globalMax = Math.max(globalMax, max)
    globalMin = Math.min(globalMin, min)
    return { min, max }
  }

  const processor = new Writable({
    write: (chunk, enc, cb) => {
      if (currentSample !== 0) {
        /* 
         * this means there is an incomplete frame from the last chunk, and 
         * the currentFrame needs to be completed
         */
        chunk.copy(currentFrame, currentSample, 0, frameSize - currentSample)
        frames.push(minmax(currentFrame))
      }
      for (; currentSample < chunk.length; currentSample += frameSize) {
        const start = currentSample
        const end = Math.min(currentSample + frameSize, chunk.length)
        chunk.copy(currentFrame, 0, start, end)
        if (end - start === frameSize) {
          /* only push if the entire frame was copied */
          frames.push(minmax(currentFrame))
        }
      }
      /* diff to figure out the overrun */
      currentSample = currentSample - chunk.length
      cb()
    }
  })

  processor.on('close', () => {
    /* write the output here, delete temp file */
    try {
      res.writeHead(200, 'let\'s go boys!', {
        'Content-Type': 'application/json'
      })
      res.end(JSON.stringify({
        success: true,
        audioRate,
        sampleRate,
        ms,
        global: {
          min: globalMin,
          max: globalMax
        },
        frames
      }))
    } catch (err) {
      res.writeHead(404, 'there was a massive error', {
        'Content-Type': 'application/json'
      })
      res.end(JSON.stringify({
        success: false,
        errors: [ 'there was a massive error', err.message ]
      }))
    }
  })

  processor.on('error', err => {
    res.writeHead(404, 'there was a massive error', {
      'Content-Type': 'application/json'
    })
    res.end(JSON.stringify({
      success: false,
      errors: [ 'there was a massive error', err.message ]
    }))
  })

  /* start and end are in ms */

  const tempFilePath = path.resolve(`./temp/${generateRandomBitString(24, 'hex')}.${fileType}`)
  const writeStream = fs.createWriteStream(tempFilePath)
  req.pipe(writeStream)

  writeStream.on('close', async () => {
    try {
      res.writeHead(200, 'good to go', {
        'Content-Type': 'audio/flac'
      })

      await stream({
        inputFile: tempFilePath,
        channels: 1,
        sampleRate: audioRate, /* {audioRate} samples per second */
        ...!!start && { start },
        ...!!end && { end },
        format: 'u8', /* unsigned pcm raw */
        outputStream: processor
      })

      await fsp.rm(tempFilePath)
    } catch (err) {
      /* I guess it's too late to change the contentType */
      console.log(err) 
    }
  })


}

function trim(params) {
  /* start and end are in ms */
  const { req, res, fileType, start, end } = params

  const tempFilePath = path.resolve(`./temp/${generateRandomBitString(24, 'hex')}.${fileType}`)
  const writeStream = fs.createWriteStream(tempFilePath)
  req.pipe(writeStream)

  writeStream.on('close', async () => {
    try {
      res.writeHead(200, 'good to go', {
        'Content-Type': 'audio/flac'
      })

      await stream({
        inputFile: tempFilePath,
        channels: 1,
        sampleRate: 48000,
        ...!!start && { start },
        ...!!end && { end },
        format: 'flac', /* unsigned pcm raw */
        outputStream: res
      })

      await fsp.rm(tempFilePath)
    } catch (err) {
      /* I guess it's too late to change the contentType */
      console.log(err) 
    }
  })

}

async function clicks(params) {
  const {
    req,
    res,
    type,
    name
  } = params

  const fileName = `${name}_${type}.raw`
  const resolvedPath = path.resolve(`./clicks/${fileName}.raw`)

  req.on('error', err => {
    res.writeHead(500, 'request error', {
      'Content-Type': 'application/json'
    })
    res.end(JSON.stringify({
      success: false,
      errors: [ 'request error', err.message ]
    }))
  })

  try {
    await fsp.access(resolvedPath)
    const readStream = fs.createReadStream(resolvedPath)

    res.writeHead(200, 'good to go', {
      'Content-Type': 'application/pcm_s24le'
    })

    readStream.pipe(res)
  } catch (err) {
    res.writeHead(404, 'there was a massive error', {
      'Content-Type': 'application/json'
    })
    res.end(JSON.stringify({
      success: false,
      errors: [ 'there was a massive error', err.message ]
    }))
  }

}

const streamingServer = http.createServer((req, res) => {
  const parsedUrl = new URL(req.url, `http://localhost:${PORT}/`) 
  const method = req.method

  const pathname = parsedUrl.pathname.toLowerCase()
  const searchParams = parsedUrl.searchParams

  const contentType = req.headers['content-type']
  const fileType = mime.extension(contentType)
  
  if (method === 'POST') {
    if (pathname === '/peaks') {
      peaks({
        req,
        res,
        fileType,
        sampleRate: searchParams.get('sample-rate') /* samples per second */
      })
      return 
    } else if (pathname === '/trim') {
      trim({ 
        req,
        res,
        fileType,
        start: searchParams.get('start'),
        end: searchParams.get('end')
      })
      return
    } else if (pathname.startsWith('/clicks')) {
      clicks({
        req,
        res,
        name: searchParams.get('name'),
        type: searchParams.get('type')
      })
    }
  }

  res.writeHead(404, 'no').end()

})

async function begin() {

  await fsp.mkdir('./temp', { recursive: true })

  streamingServer.listen(PORT, () => {
    console.log(`ffmpeg server running on port: ${PORT}`) /* do nothing */ 
  })
}

begin()
