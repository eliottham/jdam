import crypto from 'crypto'

const comma = ','.charCodeAt()
const semicolon = ';'.charCodeAt()
const equals = '='.charCodeAt()

function parse(data) {
  const dataParams = {}
  let lastIndex = 0
  /* 
   * if the chunk terminates before the semicolon token occurs,
   * then we need to track that and add the last parameter after the 
   * for loop terminates
   */
  let passedEndOfParams = false
  const parseParamKeyValue = chunk => {
    let splitIndex = -1
    for (let b = 0; b < chunk.length; b++) {
      if (chunk[b] === equals) {
        splitIndex = b
        break
      }
    }
    if (splitIndex === -1) { throw Error('unable to parse key-value') }

    return [ chunk.slice(0, splitIndex).toString('utf8'), chunk.slice(splitIndex + 1).toString('utf8') ]
  }

  for (let b = 0; b < data.length; b++) {
    const code = data[b]
    if (code === comma || code === semicolon) {
      const paramKeyValue = data.slice(lastIndex, b)
      try {
        const [ key, value ] = parseParamKeyValue(paramKeyValue)
        dataParams[key] = value
      } catch (err) {
        /* do nothing */
      }
      lastIndex = b + 1
    } 
    if (code === semicolon) {
      passedEndOfParams = true
      break
    }
  }
  if (!passedEndOfParams) {
    /* 
     * last index will stil be set at the last full parameter 
     * cut off another slice and parse it for the final parameter
     */
    const paramKeyValue = data.slice(lastIndex)
    try {
      const [ key, value ] = parseParamKeyValue(paramKeyValue)
      dataParams[key] = value
    } catch (err) {
      /* do nothing */
    }
  }
  return dataParams
}

function generateRandomBitString(length, encoding = 'base64') {
  const byteBuffer = Buffer.allocUnsafe(length) 
  crypto.randomFillSync(byteBuffer)
  return byteBuffer.toString(encoding)
}

export {
  parse as paramParse,
  generateRandomBitString
}
