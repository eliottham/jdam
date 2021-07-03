// import UID from './uid'

function colorize(input = '', alpha = 1) {
  const sum = Array.from(input).reduce((sum, char) => sum + char.charCodeAt(0), 0) 
  const hue = sum % 360
  let lightness = 55
  if (hue > 35 && hue < 200) {
    /*
     * 35 degrees is just before yellow and
     * 200 degrees is just after cyan
     */
    lightness = 25 + (hue - 35) % 25
  }
  const saturation = ((hue * Math.PI) % 25) + 65

  return `hsla(${hue}deg, ${saturation}%, ${lightness}%, ${alpha})` 
}

export default colorize

/*
for (let a = 0; a < 250; a++) {
  const hex = UID.hex(12)
  console.log(`%c${hex}`, `padding: 2px; color: white; background-color: ${colorize(hex)}`)
}
*/
