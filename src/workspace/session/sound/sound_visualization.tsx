import { useRef, useEffect, CanvasHTMLAttributes } from 'react'
import Sound from '../../../client/sound'
import colorize from '../../../client/colorize'

interface SoundVisualizationProps {
  sound: Sound,
  ms?: number,
  gridLines?: boolean
  outline?: boolean
  gradient?: boolean
  scheduled?: boolean
  fixed?: boolean
}

const renderFrames = ({ 
  current, 
  sound,
  ms,
  sampleRate = 100,
  global = 128,
  gridLines = true,
  outline = false,
  scheduled = false,
  fixed = false,
  gradient = true
}: {
  current: HTMLCanvasElement,
  sampleRate?: number,
  global?: number,
} & SoundVisualizationProps) => {

  if (!current) { return }

  const primaryColorHexA = (alpha: number) => {
    return colorize(sound.accountId, alpha)
  }

  const primaryColorHex = colorize(sound.accountId, 1)

  const ctx = current.getContext('2d')
  if (!ctx) { return }
    
  const height = current.offsetHeight
  const width = current.offsetWidth
  
  /* set canvas height and width based on layout values */
  current.height = height
  current.width = width

  const { frames = [] } = sound

  const finalMs = (ms ?? sound.ms) || 1

  if (!frames.length) { return } 

  /* scaling factor to match target range with current element height*/
  const heightFactor = height / global 
  const offset = Math.round(height / 2)
  const frameDuration = 1000 / sampleRate /* ms per frame */
  const frameCount = finalMs / frameDuration /* how many frames in the entire view */
  const xStep = width / frameCount
  const stops = sound.stops
  if (!stops.length) {
    Array.prototype.push.apply(stops, sound.getDefaultStops())
  }
  const stopInds = stops.map(stop => Math.floor(stop / 1000 * sampleRate))
  const stopFacs = stops.map(stop => Math.min(1, (stop - (scheduled ? stops[1] : 0)) / finalMs))

  /* fill the center line */
  ctx.strokeStyle = '#bbb'
  ctx.beginPath()
  ctx.moveTo(0, offset)
  ctx.lineTo(width, offset)

  if (gridLines) {
    /* fill grid lines by seconds */
    for (let g = sampleRate; g < frameCount; g += sampleRate) {
      const x = Math.round(g * xStep)
      ctx.moveTo(x, 0)
      ctx.lineTo(x, height)
    }
  }
  ctx.stroke()

  /* min is always -128 and max is always 127 */
  ctx.fillStyle = primaryColorHex
  ctx.strokeStyle = primaryColorHex
  ctx.beginPath()
  ctx.moveTo(0, Math.round(frames[0].min * heightFactor + offset))

  /* determine zero based on stopInds[1] */
  let zero = 0
  if (!fixed) {
    zero = scheduled ? stopInds[1] : stopInds[0]
  }

  const endInd = scheduled ? stopInds[3] : frames.length - 1

  /* run through the maximums forwards */
  const widthOffset = zero * xStep 
  for (let p = zero; p <= endInd; p++) {
    const max = frames[p]?.max ?? 0
    ctx.lineTo(Math.round(xStep * p) - widthOffset, Math.round(max * heightFactor + offset))
  }

  /* then the minimums backwards */
  for (let p = endInd; p >= zero; p--) {
    const min = frames[p]?.min ?? 0
    ctx.lineTo(Math.round(xStep * p) - widthOffset, Math.round(min * heightFactor + offset))
  }

  ctx.closePath()

  if (gradient) {
    let grad = ctx.createLinearGradient(0, 0, width, 0)
    if (!scheduled) { grad.addColorStop(stopFacs[0], primaryColorHexA(0)) }
    grad.addColorStop(stopFacs[1], primaryColorHex)
    grad.addColorStop(stopFacs[2], primaryColorHex)
    grad.addColorStop(stopFacs[3], primaryColorHexA(0))
    ctx.fillStyle = grad

    grad = ctx.createLinearGradient(0, 0, width, 0)
    if (!scheduled) { grad.addColorStop(stopFacs[0], primaryColorHexA(0.44)) }
    grad.addColorStop(stopFacs[1], primaryColorHex)
    grad.addColorStop(stopFacs[2], primaryColorHex)
    grad.addColorStop(stopFacs[3], primaryColorHexA(0.44))
    ctx.strokeStyle = grad
  }

  ctx.closePath()
  if (!outline) {
    ctx.fill()
  } else {
    ctx.stroke()
  }

  if (scheduled) {
    /* also draw the frames between stop[0] and stop[1] just before the end */
    const zero = stopInds[0]
    const stop1Index = Math.min(frames.length - 1, Math.floor(stopInds[1]))
    const widthOffset = Math.round(width - stop1Index * xStep)

    ctx.beginPath()
    ctx.moveTo(widthOffset, Math.round(frames[0].min * heightFactor + offset))
    for (let p = zero; p <= stop1Index; p++) {
      const max = frames[p]?.max ?? 0
      ctx.lineTo(widthOffset + Math.round(xStep * p), Math.round(max * heightFactor + offset))
    }

    /* then the minimums backwards */
    for (let p = stop1Index; p >= zero; p--) {
      const min = frames[p]?.min ?? 0
      ctx.lineTo(widthOffset + Math.round(xStep * p), Math.round(min * heightFactor + offset))
    }

    if (gradient) {
      let grad = ctx.createLinearGradient(0, 0, width, 0)
      grad.addColorStop(1 + stopFacs[0] - stopFacs[1], primaryColorHexA(0))
      grad.addColorStop(1, primaryColorHex)
      ctx.fillStyle = grad

      grad = ctx.createLinearGradient(0, 0, width, 0)
      grad.addColorStop(1 + stopFacs[0] - stopFacs[1], primaryColorHexA(0.33))
      grad.addColorStop(1, primaryColorHex)
      ctx.strokeStyle = grad
    }


    ctx.closePath()
    if (!outline) {
      ctx.fill()
    } else {
      ctx.stroke()
    }
  }

}

function SoundVisualization({
  sound,
  ms,
  fixed,
  gridLines = true,
  outline = false,
  scheduled = false,
  ...props 
}: SoundVisualizationProps & CanvasHTMLAttributes<HTMLCanvasElement>): JSX.Element {

  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {

    const onModifySound = () => {
      if (canvasRef.current) {
        renderFrames({ 
          current: canvasRef.current,
          sound,
          ms,
          fixed,
          gridLines,
          outline,
          scheduled
        })
      }
    }

    sound.on('set-sound-file', onModifySound)

    /* also needs to go here in order to change when ms changes */
    if (canvasRef.current) {
      renderFrames({ 
        current: canvasRef.current,
        sound,
        ms,
        fixed,
        gridLines,
        outline,
        scheduled
      })
    }

    return () => {
      sound.un('set-sound-file', onModifySound)
    }
  })

  return <canvas 
    ref={ canvasRef } 
    { ...props } 
    className={ `${props.className ? props.className : ''} sound-visualization` }
  />
}

export default SoundVisualization
