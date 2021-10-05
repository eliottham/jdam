function hex (length: number): string {
  const arr = new Uint8Array(length)
  const hexLut = '0123456789abcdef'
  window.crypto.getRandomValues(arr)
  let result = ''
  for (const byte of arr) {
    result += hexLut.charAt(byte >> 4)
    result += hexLut.charAt(byte & 0xF)
  }
  return result
}

export default {
  hex
}
