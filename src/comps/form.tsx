import React, {
  useState,
  useRef,
  useEffect,
  useLayoutEffect 
} from 'react'

import { Button } from '@material-ui/core'
import PopupErrors from './popup_errors'

import Form from 'client/forms/form'

import { makeStyles } from '@material-ui/styles'

const useStyles = makeStyles({
  formLabel: {
    fontVariant: 'all-small-caps',
    fontSize: '1.5rem',
    padding: '0.2em'
  },
  form: {
    flex: 1,
    display: 'flex',
    margin: '1em',
    flexDirection: 'column',
    '& .grid-wrapper': {
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      paddingTop: 24,
      '& .grid': {
        display: 'grid',
        gridAutoColumns: 'max-content 1fr',
        gridGap: '0.5em',
        flex: 1
      }
    }
  },
  launchButton: {
    '&.MuiButton-root': {
      margin: '1em 0 0'
    }
  }
})

interface FormProps { 
  model: Form
  submitText?: string
  noSubmit?: boolean
  hideErrors?: boolean
  autoHeight?: (height: number) => void
  children?: React.ReactNode
}

function FormDisplay({ 
  model,
  children,
  noSubmit = false,
  hideErrors = true,
  autoHeight,
  ...props 
}: FormProps ): JSX.Element {

  const classes = useStyles()

  const formRef = useRef<HTMLDivElement>(null)
  const [ formValid, setFormValid ] = useState(model.getValid())

  const [ errors, setErrors ] = useState<string[]>([])
  const [ showErrors, setShowErrors ] = useState(false)

  useEffect(() => {

    let timeoutIndex = -1

    const onValidate = ({ errors }: { errors: string[] }) => {
      setErrors(errors)
      setShowErrors(!!errors.length)
      setFormValid(!errors.length)

      /* errors might change the height of the form */
      if (autoHeight) {
        const rect = formRef.current?.getBoundingClientRect()
        if (rect) {
          autoHeight(Math.ceil(rect.height) + 64)
        }
      }

      if (errors.length) {
        timeoutIndex = window.setTimeout(() => {
          setShowErrors(false)
        }, 5000)
      }
    }

    for (const field of model.getFields()) {
      field.setValue(field.getValue())
    }

    model.on('validate', onValidate)

    return () => {
      model.un('validate', onValidate)
      setShowErrors(false)
      window.clearTimeout(timeoutIndex)
    }
  }, [ model, autoHeight ])

  useLayoutEffect(() => {
    if (autoHeight) {
      const rect = formRef.current?.getBoundingClientRect()
      if (rect) {
        autoHeight(Math.ceil(rect.height) + 64)
      }
    }
  })

  const handleSubmit = () => {
    model.submit() 
  }

  return (
    <div className={ classes.form } ref={ formRef }>
      <div className="grid-wrapper">
        <div className="grid">
          { children } 
        </div>
      </div>
      { !hideErrors ?
        <PopupErrors
          errors={ errors }
          showErrors={ showErrors }
        />
        :
        null
      }
      { !noSubmit &&
        <Button 
          className={ classes.launchButton }
          onClick={ handleSubmit } 
          variant="contained" 
          disabled={ !formValid }
        >
          { props.submitText || 'Submit' }
        </Button>
      }
    </div>
  )

}

export default FormDisplay
