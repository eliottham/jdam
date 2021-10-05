import React, {
  useState,
  useEffect 
} from 'react'

import {
  Slider, SliderProps 
} from '@material-ui/core'

import FormFieldDisplay, { FormFieldDisplayProps } from './form_field'

import { makeStyles } from '@material-ui/styles'

const useStyles = makeStyles({
  formSlider: {
    margin: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'stretch',
    '&.MuiSlider-root': {
      display: 'flex',
      alignItems: 'center',
      paddingTop: '1ch',
      width: 'unset',
      '& .MuiSlider-thumb': {
        marginTop: 'unset'
      }
    }
  }
})

function FormSliderDisplay({ min, max, step, model, ...props }: FormFieldDisplayProps<number> & SliderProps): JSX.Element {

  const classes = useStyles()

  const [ inputValue, setInputValue ] = useState<number | number[]>(30)

  useEffect(() => {

    const onSetValue = ({ value }: { value: number }) => {
      setInputValue(value)
    }

    model.on('set-value', onSetValue)

    return () => {
      model.un('set-value', onSetValue)
    }
  })

  const handleSliderChange = (event: Event, newValue: number | number[]) => {
    if (Array.isArray(newValue)) {
      model.setValue(newValue[0])
    } else {
      model.setValue(newValue)
    }
  }

  return (
    <FormFieldDisplay<number>
      model={ model }
      { ...props }
      className={ classes.formSlider }
    >
      <Slider
        color="primary"
        value={ Number(model.getValue() ?? inputValue) }
        step={ step ?? 10 }
        marks
        onChange={ handleSliderChange }
        min={ min ?? 10 }
        max={ max ?? 120 }
        valueLabelDisplay="auto"
      />
    </FormFieldDisplay>
  )
}

export default FormSliderDisplay
