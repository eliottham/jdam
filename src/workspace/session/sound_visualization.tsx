import { useRef, useLayoutEffect } from 'react'

function SoundVisualization({ peaks }: { peaks: Array<{min: number, max: number}> }): JSX.Element {

  const canvasRef = useRef<HTMLCanvasElement>(null)

  useLayoutEffect(() => {
    
    const current = canvasRef.current
    if (!current) { return }

    const ctx = current.getContext('2d')
    if (!ctx) { return }
      
    const height = current.offsetHeight
    const width = current.offsetWidth
    
    /* set canvas height and width based on layout values */
    current.height = height
    current.width = width

    /* scaling factor to match target range with current element height*/
    const heightFactor = height / 128 
    const xStep = width / peaks.length

    /* min is always -128 and max is always 127 */
    ctx.fillStyle = '#888'
    ctx.beginPath()
    ctx.moveTo(0, peaks[0].min * heightFactor)

    /* run through the maximums forwards */
    for (let p = 0; p < peaks.length; p++) {
      const { max } = peaks[p]
      ctx.lineTo(xStep * p, max * heightFactor)
    }

    /* then the minimums backwards */
    for (let p = peaks.length - 1; p >= 0; p--) {
      const { min } = peaks[p]
      ctx.lineTo(xStep * p, min * heightFactor)
    }

    ctx.closePath()
    ctx.fill()
     
    /* then fill path */

  })

  return (<div>
    <canvas ref={ canvasRef } />
  </div>
  )
}

export default SoundVisualization
