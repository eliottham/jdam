import React, { useEffect, useState, useRef } from 'react'
import { makeStyles } from '@material-ui/styles'

import Draggable from './draggable'

interface KnobProps {
  value?: number
  onChanging?: (initValue: number, newValue: number) => void
  onChanged?: (initValue: number, newValue: number) => void
  onReset?: () => number
  min?: number
  max?: number
}

const knobRadius = 12

export { knobRadius }

const useStyles = makeStyles({
  root: {
    '--radius': knobRadius * 2,
    height: 'var(--radius)',
    width: 'var(--radius)',
    backgroundColor: 'var(--grey)',
    border: '1px solid var(--d-grey)',
    borderRadius: '100%',
    position: 'relative',
    overflow: 'hidden',
    '& > .indicator': {
      height: '50%',
      width: 'calc(50% + 1px)',
      borderRight: '2px solid var(--d-grey)',
      transformOrigin: 'calc(100% - 1px) 100%'
    },
    '&.changing': {
      backgroundColor: 'var(--primary)'
    }
  }
})

function Knob({ 
  value = 0.5,
  onChanging,
  onChanged,
  onReset,
  min = 0,
  max = 1 
}: KnobProps): JSX.Element {


  const indicatorRef = useRef<HTMLDivElement>(null)

  const [ knobValue, setKnobValue ] = useState(value) 

  const classes = useStyles()

  const handleOnChanging = (initX: number, initY: number, diffX: number, diffY: number) => {
    /* diffX and diffY are passed in UNSCALED */
    const newVal = Math.max(min, Math.min(max, initX + ((diffX - diffY) / 350)))
    setKnobValue(newVal)
    onChanging?.(initX, newVal)
  }

  const handleOnChanged = (initX: number, initY: number, diffX: number, diffY: number) => {
    /* do something */
    const newVal = Math.max(min, Math.min(max, initX + ((diffX - diffY) / 350)))
    onChanged?.(initX, newVal)
  }

  const handleOnReset = (): [ x: number, y: number ] => {
    /* reset the value to default on double click */
    const resetValue = onReset?.() || value
    setKnobValue(resetValue)
    return [ resetValue, 0 ] 
  }

  const getRotation = (value: number) => {
    const fac = (max - value) / (max - min) 
    return (fac - 0.5) * (Math.PI * 1.7)
  }

  return (
    <Draggable
      className={ classes.root }
      onChanging={ handleOnChanging }
      onChanged={ handleOnChanged }
      onReset={ handleOnReset }
      x={ value ?? knobValue }
    >
      <div 
        ref={ indicatorRef }
        className="indicator"
        style = { { transform: `rotate(${-getRotation(value ?? knobValue)}rad)` } }
      />
    </Draggable>
  )
}
 
export default Knob
