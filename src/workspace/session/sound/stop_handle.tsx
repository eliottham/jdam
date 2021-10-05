import React, {
  useState, 
  useEffect,
  useRef 
} from 'react'

import Draggable from '../../../comps/draggable'
import { 
  TriRightSmallIcon,
  TriLeftSmallIcon,
  CircleSmallIcon
} from '../../../comps/icons'

import { makeStyles } from '@material-ui/styles'

const iconSize = 17

export { iconSize }

const useStyles = makeStyles({
  root: {
    '--col': 'var(--primary)',
    height: '100%',
    position: 'absolute',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'stretch',
    alignItems: 'center',
    width: 12,
    transform: 'translate3d(-50%, 0, 0)',
    left: 0,
    '& > svg': {
      stroke: 'var(--primary)',
      fill: 'var(--primary)',
      height: iconSize,
      width: iconSize,
      marginTop: -iconSize
    },
    '& > .line': {
      width: 0,
      flex: 1,
      borderLeft: '2px dashed var(--primary)'
    },
    '&.playhead': {
      '& > .line': {
        borderLeft: '2px solid var(--lt-blue)'
      },
      '& > svg': {
        position: 'absolute',
        bottom: -(iconSize - 1),
        stroke: 'var(--lt-blue)',
        fill: 'var(--lt-blue)',
        height: iconSize,
        width: iconSize,
        transform: 'rotate(180deg)'
      }
    }
  }
})

interface StopHandleProps {
  x?: number
  totalWidth?: number
  min?: number
  max?: number
  type: 'samplestart' | 'fadeinend' | 'fadeoutstart' | 'sampleend' | 'playhead'
  onChanging?: (initValue: number, newValue: number) => void
  onChanged?: (initValue: number, newValue: number) => void
  onReset?: () => number
}

function StopHandle({
  x = 0,
  totalWidth = 1,
  type,
  onChanged,
  onChanging,
  onReset,
  min,
  max 
}: StopHandleProps): JSX.Element {

  const ref = useRef<HTMLDivElement>(null)

  const classes = useStyles()

  const [ xValue, setXValue ] = useState(x)

  useEffect(() => {
    if (ref.current) {
      ref.current.style.left = `${100 * x / totalWidth}%`
    }
    setXValue(x)
  }, [ x, totalWidth, min, max ])

  const getIcon = () => {
    switch (type) {
    case 'fadeinend':
      return <TriRightSmallIcon/>
    case 'fadeoutstart':
      return <TriLeftSmallIcon/>
    case 'playhead':
    default:
      return <CircleSmallIcon/>
    }
  }

  const handleOnChanging = (initX: number, initY: number, diffX: number) => {
    /* do something */
    const newVal = Math.max(min ?? 0, Math.min(max || totalWidth, initX + diffX))
    setXValue(newVal)
    if (ref.current) {
      ref.current.style.left = `${100 * newVal / totalWidth}%`
    }
    onChanged?.(initX, newVal)
  }

  const handleOnChanged = (initX: number, initY: number, diffX: number) => {
    /* do something */
    const newVal = Math.max(min ?? 0, Math.min(max || totalWidth, initX + diffX))
    onChanging?.(initX, newVal)
  }

  const handleOnReset = (): [ x: number, y: number ] => {
    /* do nothing */
    const resetValue = onReset?.() || x
    return [ resetValue, 0 ]
  }

  return (
    <Draggable
      ref={ ref }
      className={ `${classes.root} ${type}` }
      onChanging={ handleOnChanging }
      onChanged={ handleOnChanged }
      onReset={ handleOnReset }
      x={ xValue }
    >
      { getIcon() }
      <div className="line"/>
    </Draggable>
  )
}

export default StopHandle
