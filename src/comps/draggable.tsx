import React, {
  useState,
  forwardRef 
} from 'react'

import { makeStyles } from '@material-ui/styles'

interface DraggableProps {
  x?: number
  y?: number
  setX?: (x: number) => void
  setY?: (y: number) => void
  onChangeStart?: (initX: number, initY: number) => void
  onChanging?: (initX: number, initY: number, diffX: number, diffY: number) => void 
  onChanged?: (initX: number, initY: number, diffX: number, diffY: number) => void 
  onReset?: () => [ newX: number, newY: number ]
  children: JSX.Element | JSX.Element[]
  className?: string
}

const useStyles = makeStyles({
  root: {
    position: 'relative'
  }
})

const Draggable = forwardRef<HTMLDivElement, DraggableProps>(({
  x = 0,
  y = 0,
  setX,
  setY,
  onChangeStart,
  onChanging,
  onChanged,
  onReset,
  children,
  className = '' 
}: DraggableProps, ref) => {

  const [ xValue, setXValue ] = useState(x) 
  const [ yValue, setYValue ] = useState(y) 
  const [ changing, setChanging ] = useState(false)

  const classes = useStyles()

  /* FML the default MouseEvent and the React MouseEvent are NOT compatible */
  const onMouseDown = (evt: React.MouseEvent<HTMLDivElement>) => {
    const startPos = [ evt.clientX, evt.clientY ]
    const initX = x ?? xValue
    const initY = y ?? yValue
    let diffX = 0
    let diffY = 0
    setChanging(true)
    onChangeStart?.(initX, initY)
    const onMouseMove = (evt: MouseEvent) => {
      diffX = evt.clientX - startPos[0]
      diffY = evt.clientY - startPos[1]
      onChanging?.(initX, initY, diffX, diffY)
    }
    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove)
      onChanged?.(initX, initY, diffX, diffY)
      setX?.(initX + diffX)
      setY?.(initY + diffY)
      setChanging(false)
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp, { once: true })
  }

  const onDoubleClick = () => {
    /* 
     * reset the value to default on double click 
     * if implementer does not supply a reset function,
     * then do not change
     */
    const result = onReset?.()
    if (result) {
      setXValue(result[0])
      setYValue(result[1])
    }
  }

  return (
    <div 
      ref={ ref }
      className={ className + ` ${classes.root} ${changing ? 'changing' : ''}` }
      onMouseDown={ onMouseDown }
      onDoubleClick={ onDoubleClick } 
    >
      { children }
    </div>
  )
})

Draggable.displayName = 'Draggable'
 
export default Draggable
