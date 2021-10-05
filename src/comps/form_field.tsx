import React, {
  useState,
  useEffect
} from 'react'

import { LinearProgress } from '@material-ui/core'
import { makeStyles } from '@material-ui/styles'
import { FormField } from 'client/forms/form'
import { LatentStatus } from 'client/validation'

const useStyles = makeStyles({
  formLabel: {
    fontVariant: 'all-small-caps',
    fontSize: '1.5rem',
    padding: '0.2em',
    gridColumn: 1
  },
  formField: {
    position: 'relative',
    /* minWidth: 400, */
    marginBottom: '1em',
    borderRadius: 4,
    gridColumn: 2,
    /* overflow: 'hidden', */
    '& .MuiLinearProgress-root': {
      transform: 'translate3d(0, -100%, 0)',
      width: '100%',
      position: 'absolute',
      height: 3
    },
    '& input': {
      width: '100%',
      padding: '0.4em',
      fontSize: '1.2rem',
      borderRadius: 4,
      outline: 'none',
      border: '1px solid var(--grey)',
      backgroundColor: 'var(--slt-grey)',
      transition: 'all 100ms',
      '&.filled': {
        '--col-s': 'var(--lt-blue-s)',
        borderColor: 'rgb(var(--col-s))',
        backgroundColor: 'rgba(var(--col-s), 0.2)',
        '&.pending': {
          '--col-s': 'var(--lt-yellow-s)'
        },
        '&.invalid': {
          '--col-s': 'var(--red-s)'
        }
      },
      '&::placeholder': {
        color: 'var(--lt-grey)',
        fontVariant: 'all-small-caps',
        fontWeight: 400,
        fontFamily: '\'Lato\', sans-serif'
      }
    },
    '&.confirm': {
      '& .upper-field input': {
        borderRadius: '4px 4px 0 0',
        borderBottomColor: 'var(--lt-grey)'
      },
      '& .lower-field input': {
        borderTop: 'none',
        borderRadius: '0 0 4px 4px'
      },
      '& $formField': {
        margin: 0
      }
    },
    '& .error': {
      color: 'var(--red)'
    }
  }
})

export interface FormFieldDisplayProps<ValueType> {
  model: FormField<ValueType>
  label?: string
  fragment?: boolean
  noLabel?: boolean
  className?: string
  hidePending?: boolean
  hideErrors?: boolean
  children?: React.ReactNode
}

function FormFieldDisplay<ValueType>({
  model,
  label,
  fragment = false,
  noLabel = false,
  className,
  hidePending = true,
  hideErrors = true,
  children,
  ...props 
}: FormFieldDisplayProps<ValueType>): JSX.Element {

  const classes = useStyles()

  const [ validationErrors, setValidationErrors ] = useState<string[]>([])
  const [ inputValue, setInputValue ] = useState<ValueType>()
  const [ pendingValidation, setPendingValidation ] = useState(model.pendingValidation)
  const [ showErrors, setShowErrors ] = useState(false)

  useEffect(() => {
    const onValidationErrors = ({ errors }: { errors: string[] }) => {
      setShowErrors(!!errors.length)
      setValidationErrors(errors)
    }

    const onPendingValidation = ({ status }: { status: LatentStatus }) => {
      setShowErrors(false)
      setPendingValidation(status === 'pending')
    }

    const onSetValue = ({ value }: { value: ValueType }) => {
      setInputValue(value) 
    }

    model.on('validate', onValidationErrors)
    model.on('pending', onPendingValidation)
    model.on('set-value', onSetValue)

    model.setValue(model.getValue())

    return () => {
      model.un('validate', onValidationErrors)
      model.un('pending', onPendingValidation)
      model.un('set-value', onSetValue)
    }
  }, [ model ])

  const classNames = []

  if (validationErrors.length) {
    classNames.push('errors')
  }

  if (inputValue) {
    classNames.push('filled')
  }

  if (pendingValidation) {
    classNames.push('pending-latent')
  }

  const childrenProcedural = [
    <div 
      className={ `${classes.formField} ${className || ''} ${classNames.join(' ')}` } key={ `field-${model.name}` }
      { ...props }
    >
      { children }
      {
        pendingValidation && !hidePending ? <LinearProgress/> : null
      }
      { 
        !hideErrors && showErrors ?
          <div>
            { validationErrors.map((error, index) => {
              return <div key={ index } className="error">{ error }</div>
            })
            }
          </div>
          :
          null
      }
    </div>
  ]

  if (!noLabel) { 
    childrenProcedural.unshift(
      <div className={ classes.formLabel } key={ `label-${model.name}` }>{ label ? label : '' }</div>
    )
  }

  return React.createElement(fragment ? React.Fragment : 'div', { ...!fragment && { className: classes.formField }}, childrenProcedural)
}

interface TextFormFieldDisplayProps extends FormFieldDisplayProps<string> {
  hint?: string
  enableEnterKey?: boolean
  type?: 'text' | 'password'
  onEnter?: () => void
}

function TextFormFieldDisplay({ 
  model,
  hint,
  enableEnterKey = false,
  onEnter,
  type = 'text',
  hidePending = false,
  hideErrors = false,
  ...props
}: TextFormFieldDisplayProps): JSX.Element {

  const [ inputValue, setInputValue ] = useState(model.getValue() || '')

  useEffect(() => {

    const onSetInputValue = ({ value }: { value: string }) => {
      setInputValue(value)
    }

    model.on('set-value', onSetInputValue)

    return () => {
      model.un('set-value', onSetInputValue)
    }
  }, [ model ])

  const onChange = (evt: React.ChangeEvent<HTMLInputElement>) => {
    model.setValue(evt.currentTarget.value)
  }

  const onKeyupHandler = (evt: React.KeyboardEvent<HTMLInputElement>) => {
    if (enableEnterKey && evt.key === 'Enter') {
      model.setValue(evt.currentTarget.value)
      onEnter?.()
    }
  }

  return (
    <FormFieldDisplay<string>
      model={ model }
      hidePending={ hidePending }
      hideErrors={ hideErrors }
      { ...props }
    >
      <input 
        type={ type }
        onChange={ onChange }
        value={ inputValue }
        onKeyUp={ onKeyupHandler }
        { ...hint && { placeholder: hint } }
      />
    </FormFieldDisplay>
  )
}

export default FormFieldDisplay
export { TextFormFieldDisplay }

interface ConfirmTextFormFieldDisplayProps extends TextFormFieldDisplayProps {
  confirmModel: FormField<string>
}

function ConfirmTextFormFieldDisplay({ 
  model,
  confirmModel,
  hint,
  type,
  ...props
}: ConfirmTextFormFieldDisplayProps): JSX.Element {

  return (
    <FormFieldDisplay<string>
      className="confirm"
      model={ model }
      { ...props }
      hideErrors={ false }
    >
      <TextFormFieldDisplay
        className="upper-field"
        noLabel
        model={ model }
        type={ type }
        hideErrors
      />
      <TextFormFieldDisplay
        className="lower-field"
        noLabel
        hint={ hint }
        model={ confirmModel }
        type={ type }
        hideErrors
      />
    </FormFieldDisplay>
  )
}

export { ConfirmTextFormFieldDisplay }
