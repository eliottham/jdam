import { useState } from 'react'
import { Slider, SliderProps } from '@material-ui/core'

import FormField, { FormFieldProps } from './form_field'

import { makeStyles } from '@material-ui/styles'

const useStyles = makeStyles({
  formSlider: {
    '&.MuiSlider-root': {
      display: 'flex',
      height: '100%',
      alignItems: 'center',
      paddingTop: '1ch',
      margin: '0 1em',
      width: 'unset',
      '& .MuiSlider-thumb': {
        marginTop: 'unset'
      }
    }
  }
})

function FormSlider({ min, max, step, fieldValue, setFieldValue, ...props }: FormFieldProps & SliderProps): JSX.Element {

  const classes = useStyles()

  const [ inputValue, setInputValue ] = useState<number | number[]>(30)

  const handleSliderChange = (event: Event, newValue: number | number[]) => {
    setFieldValue ? setFieldValue('' + newValue) : setInputValue(newValue)
  }

  return (
    <FormField
      { ...props }
    >
      <Slider
        color="primary"
        className={ classes.formSlider }
        value={ Number(fieldValue ?? inputValue) }
        step={ step ?? 10 }
        marks
        onChange={ handleSliderChange }
        min={ min ?? 10 }
        max={ max ?? 120 }
        valueLabelDisplay="auto"
      />
    </FormField>
  )
}

export default FormSlider
