import { useState, useEffect } from 'react'
import { LinearProgress } from '@material-ui/core'
import { makeStyles } from '@material-ui/styles'

const useStyles = makeStyles({
  formLabel: {
    fontVariant: 'all-small-caps',
    fontSize: '1.5rem',
    padding: '0.2em'
  },
  formField: {
    position: 'relative',
    /* minWidth: 400, */
    marginBottom: '1em',
    borderRadius: 4,
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
        fontFamily: "'Lato', sans-serif"
      }
    },
    '&.confirm input': {
      '&:first-child': {
        borderRadius: '4px 4px 0 0',
        borderBottomColor: 'var(--lt-grey)'
      },
      '&.confirm': {
        borderTop: 'none',
        borderRadius: '0 0 4px 4px'
      }
    },
    '& .error': {
      color: 'var(--red)'
    }
  }
})

export interface FormFieldTemplate {
    name: string
    child?: React.ReactNode
    label?: string
    type?: string
    confirm?: boolean
    validation?: (input: string) => string[],
    latentValidation?: (input: string) => Promise<string[]>
    hint?: string
}

export interface FormFieldProps extends FormFieldTemplate {
    fragment: boolean
    fieldValue?: string
    setFieldValue?: (newValue: string) => void
    validate?: boolean
    onChange?: (newValue: string) => void
    onValidate?: (valid: boolean) => void
    onEnter?: (value: string, confirm: boolean) => void
    children?: React.ReactNode
}

function FormField({
  fragment = false,
  fieldValue, 
  validation,
  confirm,
  validate,
  onValidate = () => { /* noop */ },
  latentValidation,
  ...props }: FormFieldProps): JSX.Element {

  const classes = useStyles()

  const [ validationErrors, setValidationErrors ] = useState<string[]>([])
  const [ inputValue, setInputValue ] = useState('')
  const [ confirmValue, setConfirmValue ] = useState('')
  const [ pendingValidation, setPendingValidation ] = useState(false)

  useEffect(() => {

    let timeoutIndex = -1

    const validateFieldValue = (input: string): boolean => {
      let valid = false
      setPendingValidation(false)
      if (validation) {
        const errors = validation(input)
        if (confirm && input !== confirmValue) {
          errors.push('values do not match') 
        }
        valid = !!input && !errors.length
        setValidationErrors(errors)
      } 

      /* 
       * perform latent validation after validating, but skip if input is blank
       * or already invalid
       */
      if (validate && latentValidation && valid && input) {
        if (timeoutIndex >= 0) { window.clearTimeout(timeoutIndex) }
        setPendingValidation(true)
        onValidate(false)
        timeoutIndex = window.setTimeout(async () => {
          if (latentValidation && input) {
            const errors = await latentValidation(input)
            setPendingValidation(false)
            onValidate(!errors.length)
            setValidationErrors(errors)
          }
        }, 1500)
      } else {
        onValidate(valid)
      }
      return valid
    }

    !props.children && validateFieldValue(fieldValue ?? inputValue)

    return () => {
      if (timeoutIndex) { window.clearTimeout(timeoutIndex) }
    }
  }, [ 
    fieldValue,
    inputValue,
    confirm,
    latentValidation,
    validate,
    confirmValue,
    validation 
  ])

  const onChange = (evt: React.ChangeEvent<HTMLInputElement>) => {
    (props.setFieldValue ?? setInputValue)(evt.target.value)
    props.onChange?.(evt.target.value)
  }

  /* 
   * on confirm should only check if the confirmation value is the same as the
   * regular field value 
   */
  const onConfirm = (evt: React.ChangeEvent<HTMLInputElement>) => {
    setConfirmValue(evt.target.value)
    let valid = true
    if (validate && validation && confirm) {
      /* 
       * get any existing validation errors and then append a new error if the
       * values don't match
       */
      const errors = validation(fieldValue ?? inputValue)
      if (evt.target.value !== fieldValue ?? inputValue) {
        errors.push('values do not match') 
      }
      valid = !errors.length
      setValidationErrors(errors)
    }
    onValidate(valid)
  }

  const onKeyupHandler = (evt: React.KeyboardEvent<HTMLInputElement>) => {
    if (props.onEnter && evt.keyCode === 13) {
      const isConfirm = !!evt.currentTarget.getAttribute('confirm')
      props.onEnter(fieldValue ?? inputValue, isConfirm)
    }
  }

  const className = pendingValidation ? 'pending' : (validation && validationErrors.length ? 'invalid' : '')
  const filled = (fieldValue ?? inputValue) && validation ? 'filled' : ''
  const confirmFilled = confirmValue && validation ? 'filled' : ''
  const useChildren = !!props.children

  return React.createElement(fragment ? React.Fragment : 'div', { ...!fragment && { className: classes.formField }}, [
    <div className={ classes.formLabel } key={ `label-${props.name}` }>{ props.label ? props.label : '' }</div>,
    <div className={ `${ classes.formField } ${confirm ? 'confirm' : ''}` } key={ `field-${props.name}` }>
      { useChildren && props.children }
      { !useChildren &&
        <input 
          type={ props.type ? props.type : "text" }
          className={ `form-input ${className} ${filled ? 'filled' : ''}` } 
          onChange={ onChange }
          value={ fieldValue ?? inputValue }
          onKeyUp={ onKeyupHandler }
          { ...props.hint && { placeholder: props.hint }}
        />
      }
      { (!useChildren && confirm) &&
        <input 
          type={ props.type ? props.type : "text" }  
          className={ `form-input confirm ${className} ${confirmFilled ? 'filled' : ''}` }
          onChange={ onConfirm } 
          placeholder={ `Confirm ${props.label}` }
          onKeyUp={ onKeyupHandler }
          { ...{confirm: 'confirm'}}
        />
      }
      {
        pendingValidation && <LinearProgress/>
      }
      {
        (validate && validation) && validationErrors.map((err, index) => {
          return <div className="error" key={ `${props.label}-err-${index}` }>{ err }</div>
        })
      }
    </div>
  ])
}

export default FormField
