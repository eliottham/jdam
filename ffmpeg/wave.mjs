import fs, { promises as fsp } from 'fs'
import { spawn } from 'child_process'
import path from 'path'

const SAMPLE_RATE = 48000
const CHANNELS = 2 /* stereo */
const BIT_DEPTH = 24 /* PCM */
const BYTE_DEPTH = BIT_DEPTH / 8

function waveHeader({ length, channels = CHANNELS }) {

  /*
   * Offset(b)  Endian   Sample Value      Description
   *   0         BE      "RIFF"            Marks the file as a riff file. Characters are each 1 byte long.
   *   4         LE      File size (int)   Size of the overall file - 8 bytes, in bytes (32-bit integer). Typically, you'd fill this in after creation.
   *                                         4 + (8 + SubChunk1Size) + (8 + SubChunk2Size)
   *
   *   8         BE      "WAVE"            File Type Header. For our purposes, it always equals "WAVE".
   *   12        BE      "fmt "            Format chunk marker. Includes trailing null
   *   16        LE      16                Length of format data as listed above
   *   20        LE      1                 Type of format (1 is PCM) - 2 byte integer
   *   22        LE      2                 Number of Channels - 2 byte integer
   *   24        LE      44100             Sample Rate - 32 byte integer. Common values are 44100 (CD), 48000 (DAT). Sample Rate = Number of Samples per second, or Hertz.
   *   28        LE      176400            (Sample Rate * BitsPerSample * Channels) / 8.
   *   32        LE      4                 (BitsPerSample * Channels) / 8 1 - 8 bit mono, 2 - 8 bit stereo/16 bit mono, 4 - 16 bit stereo
   *   34        LE      16                Bits per sample
   *   36        BE      "data"            "data" chunk header. Marks the beginning of the data section.
   *   40        LE      File size (data)  Size of the data section. 
   *   44        LE                        Rest of the data
   */

  const sampleCount = length * SAMPLE_RATE * channels * (BIT_DEPTH / 8)

  const dataHeader = Buffer.allocUnsafe(44)

  /* sub-chunk 1 */
  dataHeader.write("RIFF", 0, "utf8")
  dataHeader.writeUInt32LE(sampleCount + 36, 4)
  dataHeader.write("WAVE", 8, "utf8")
  dataHeader.write("fmt ", 12, "utf8")
  dataHeader.writeUInt32LE(16, 16)
  dataHeader.writeUInt16LE(1, 20) /* format, PCM = 1 */
  dataHeader.writeUInt16LE(channels, 22) /* number of channels, mono = 1 */
  dataHeader.writeUInt32LE(SAMPLE_RATE, 24) /* sampleRate */
  dataHeader.writeUInt32LE((SAMPLE_RATE * BIT_DEPTH * channels) / 8, 28) /* byteRate = (Sample Rate * BitsPerSample * Channels) / 8 */
  dataHeader.writeUInt16LE((BIT_DEPTH * channels) / 8, 32) /* block alignment = (BitsPerSample * Channels) / 8 */
  dataHeader.writeUInt16LE(BIT_DEPTH, 34) /* bits per sample */
  
  /* sub-chunk 2 */
  dataHeader.write("data", 36, "utf8") /* identifier = "data" */
  dataHeader.writeUInt32LE(sampleCount, 40) /* chunk size */

  return dataHeader

}

async function metronome(
  bpm = 120,
  /* division = 4, */
  pattern = [ 2, 1, 1, 1 ] /* 2 for high ping, 1 for low ping, 0 for off */
) {

  /* 
   * calculate the length of the click track data segment, then add 44 to it
   * (the length of the wav header)
   *
   * measure length (in seconds) is 1/bpm * beats^2/division * 60
   * RAW PCM data length would then be (measure length) * SAMPLE_RATE
   */

  // const fileName = `./metro_${bpm}_${beats}-${division}`
  const beats = pattern.length
  const fileName = `./metro_${bpm}_${beats}`
  const rawFile = path.resolve(fileName + '.raw')
  const wavFile = path.resolve(fileName + '.flac')

  const writeStream = fs.createWriteStream(rawFile)

  // const length = (beats * beats * 60) / (bpm * division)
  const length = (60 / bpm * beats)
  const sampleSize = BYTE_DEPTH /* we are forcing mono, so omit multiplying by channel count */
  const offsetStartToStart = (length / beats) * SAMPLE_RATE * sampleSize /* bytes between the starts of each ping */

  const [ highPing, lowPing ] = await Promise.all([ fsp.readFile('./click_high.raw'), fsp.readFile('./click_low.raw') ])

  /* start writing pcm data */
  const totalBytes = (length * SAMPLE_RATE * sampleSize)
  const frameSize = 8192
  const frame = Buffer.alloc(frameSize)
  
  const stops = [ 0 ]
  for (let b = 1; b < beats; b++) {
    const currentStartOffset = offsetStartToStart * b
    /* 
     * this adjustment is required in order to align the samples in a way that
     * works correctly with the BIT/BYTE_DEPTH of the input data. Otherwise it
     * could drift over alignment and corrupt the output
     */
    const adjustedStartOffset = currentStartOffset - (currentStartOffset % sampleSize)
    stops.push(adjustedStartOffset)
  }

  /* put a stop at the end to make calculations easier later */
  stops.push(totalBytes)

  let patternIndex = 0
  for (let b = 0; b < beats; b++) {
    const currentStop = stops[ b ]
    const nextStop = stops[ b + 1 ]
    const currentPattern = pattern[patternIndex]
    patternIndex = Math.min(patternIndex + 1, pattern.length - 1) 
    let bytesLeft = nextStop - currentStop
    let currentByte = 0

    if (currentPattern) {
      const sample = currentPattern === 2 ? highPing : lowPing
      writeStream.write(sample)
      currentByte = sample.length
    }

    while (currentByte < bytesLeft) {
      const writeBytes = Math.min(bytesLeft - currentByte, frameSize)
      writeStream.write(frame.slice(0, writeBytes))
      currentByte += writeBytes
    }
  }

  writeStream.close()
  
  const outputFile = await convertRawToWav({ rawFile, wavFile, channels: 1 }) 
  await fsp.rm(rawFile) /* clean up the raw file */

  return outputFile
}

function convertRawToWav({ rawFile, wavFile, channels = CHANNELS, sampleRate = SAMPLE_RATE, bitDepth = BIT_DEPTH }) {
  return new Promise(resolve => {
    /* default is signed PCM little-endian data */
    const resolvedOutput = path.resolve(wavFile)
    const proc = spawn('ffmpeg', [ 
      '-guess_layout_max', 0, /* disable warning about guessing layout; we tell it which layout with -ac */
      '-f', `s${bitDepth}le`, /* set the format to signed {bitDepth} little-endian */
      '-ar', sampleRate, /* set the bit rate */
      '-ac', channels, /* set the number of channels */
      '-i', path.resolve(rawFile), /* input file */
      // '-c:a', `pcm_s${bitDepth}le`, /* audio codec for output file */
      '-y', /* overwrite existing output file */
      resolvedOutput /* the actual output file */
    ])
    /*
    proc.stdout.on('data', console.log)
    proc.stderr.on('data', data => { console.log(data.toString('utf8')) })
    */
    proc.on('close', () => {
      resolve(resolvedOutput)
    })
    proc.on('error', err => {
      console.dir(err)
    })
  })
}

function stream({
  inputFile,
  inputStream,
  inputFormat,
  outputStream,
  channels = CHANNELS,
  sampleRate = SAMPLE_RATE,
  start,
  end,
  format = 's8' /* signed pcm raw */
}) {
  return new Promise((resolve, reject) => {
    /* default is signed PCM little-endian data */

    const args = [ 
      '-ar', sampleRate, /* set the bit rate */
      '-ac', channels, /* set the number of channels */
      // '-c:a', `pcm_s24le`, /* audio codec for output file */
      '-f', format,
      'pipe:1' /* write directly to stdout, which we will pipe to outputStream */
      // '2>', '/dev/null' /* pipe stderr to dev/null */
    ]

    if (!inputStream) {
      const resolvedInput = path.resolve(inputFile)
      args.unshift('-i', resolvedInput) /* input file */
    } else {
      args.unshift('-i', 'pipe:0') /* stdin */
      args.unshift('-f', inputFormat) /* need to tell the input stream what format to be in */
    }

    if (end && !isNaN(end)) {
      args.unshift('-to', `${end}ms`)
    }

    if (start && !isNaN(start)) {
      args.unshift('-ss', `${start}ms`)
    }

    const proc = spawn('ffmpeg', args)
    /*
    proc.stdout.on('data', console.log)
    proc.stderr.on('data', data => { console.log(data.toString('utf8')) })
    */
    proc.on('close', () => {
      resolve()
    })
    proc.on('error', err => {
      reject(err)
    })

    if (inputStream) {
      inputStream.pipe(proc.stdin)
    }

    proc.stdout.pipe(outputStream)
  })
}

export {
  metronome,
  convertRawToWav,
  stream
}
