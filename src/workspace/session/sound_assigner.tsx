import React, { useRef } from 'react'

import Session from '../../client/session'
import Sound from '../../client/sound'

import { makeStyles } from '@material-ui/styles'

import { AssignSoundIcon } from '../../comps/icons'

const useStyles = makeStyles({
  root: {
    position: 'relative'
  }
})


interface SoundAssignerProps {
  sound: Sound
  session: Session
  className?: string
}

const overlayLayer = document.createElement('div')
overlayLayer.style.cssText = `
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  pointer-events: none;
  z-index: 1300;
  display: none;
  cursor: none;
`

document.body.appendChild(overlayLayer)

const overlayCanvas = document.createElement('canvas')
overlayLayer.appendChild(overlayCanvas)

const render = ({
  initX,
  initY,
  x,
  y
}: {
  initX?: number,
  initY?: number,
  x?: number,
  y?: number
}) => {

  const ctx = overlayCanvas.getContext('2d')
  if (!ctx) { return }

  overlayCanvas.height = overlayLayer.offsetHeight
  overlayCanvas.width = overlayLayer.offsetWidth 

  ctx.fillStyle = 'rgb(75, 136, 234)'
  ctx.strokeStyle = 'rgb(75, 136, 234)'
  ctx.lineWidth = 5

  if (typeof initX === 'number' &&
      typeof initY === 'number' && 
      typeof x === 'number' &&
      typeof y === 'number') {
    ctx.beginPath()

    ctx.ellipse(initX, initY, 5, 5, 0, 0, 360)
    ctx.ellipse(x, y, 9, 9, 0, 0, 360)
    
    ctx.fill()

    ctx.beginPath()
    ctx.moveTo(initX, initY)
    ctx.lineTo(x, y)

    ctx.stroke()
  }

}

window.addEventListener('resize', () => {
  render({})
})

const begin = (
  x: number,
  y: number,
  onQuery: (x: number, y: number) => void,
  onDrop: (x: number, y: number) => void) => {
  overlayLayer.style.display = 'block'
  overlayLayer.style.pointerEvents = 'all'
  const initX = x
  const initY = y
  render({
    x: initX,
    y: initY,
    initX,
    initY
  })

  const mousemove = (evt: MouseEvent) => {
    /* do something */
    render({
      x: evt.clientX,
      y: evt.clientY,
      initX,
      initY
    })
    onQuery(evt.clientX, evt.clientY)
  }

  const end = (evt: MouseEvent) => {
    overlayLayer.style.display = 'none'
    overlayLayer.style.pointerEvents = 'none'
    onDrop(evt.clientX, evt.clientY)
    window.removeEventListener('mousemove', mousemove)
  }

  window.addEventListener('mouseup', end, { once: true })
  window.addEventListener('mousemove', mousemove)
}

function SoundAssigner({ session, sound, className }: SoundAssignerProps): JSX.Element {

  const classes = useStyles()
  const ref = useRef<HTMLDivElement>(null)

  const onChangeStart = () => {
    if (!ref.current) { return }
    const rect = ref.current.getBoundingClientRect()
    begin(
      rect.x + rect.width / 2 - 3,
      rect.y + rect.height / 2,
      (x: number, y: number) => { session.queryInteractiveAssignSound(x, y) },
      (x: number, y: number) => {
        session.dropInteractiveAssignSound(x, y) 
        setTimeout(() => {
          session.cancelInteractiveAssignSound()
        })
      }
    )
    session.beginInteractiveAssignSound({ sound })
  }

  return (
    <div
      ref={ ref }
      onMouseDown={ onChangeStart }
      className={ `${classes.root} flex-center ${className || ''}` }
    >
      <AssignSoundIcon/>
    </div>
  )
}

export default SoundAssigner
