import { useState, useEffect } from 'react'
import { 
  LinearProgress
} from '@material-ui/core'
import { makeStyles } from '@material-ui/styles'

const useStyles = makeStyles({
  formLabel: {
    fontVariant: 'all-small-caps',
    fontSize: '1.5rem',
    padding: '0.2em'
  },
  formField: {
    position: 'relative',
    width: 400,
    marginBottom: '1em',
    borderRadius: 4,
    overflow: 'hidden',
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
    name: string,
    child?: boolean,
    label?: string,
    type?: string,
    confirm?: boolean,
    validation?: (input: string) => string[],
    latentValidation?: (input: string) => Promise<string[]>,
    hint?: string
}

export interface FormFieldProps extends FormFieldTemplate {
    fragment: boolean,
    value?: string,
    validate?: boolean,
    onChange: (newValue: string) => void,
    onValidate: (valid: boolean) => void,
    onEnter?: (value: string, confirm: boolean) => void
}

function FormField({ fragment = false, ...props }: FormFieldProps): JSX.Element {

  const classes = useStyles()

  const [ validationErrors, setValidationErrors ] = useState<string[]>([])
  const [ fieldValue, setFieldValue ] = useState('')
  const [ confirmValue, setConfirmValue ] = useState('')
  const [ timeoutIndex, setTimeoutIndex ] = useState(-1)
  const [ pendingValidation, setPendingValidation ] = useState(false)

  useEffect(() => {
    if (props.value) {
      validateFieldValue(props.value)
      setFieldValue(props.value)
    }

    return () => {
      if (timeoutIndex) { window.clearTimeout(timeoutIndex) }
    }
  }, [])

  const validateFieldValue = (input: string): boolean => {
    let valid = true
    setPendingValidation(false)
    if (props.validate && props.validation) {
      const errors = props.validation(input)
      if (props.confirm && input !== confirmValue) {
        errors.push('values do not match') 
      }
      valid = !errors.length
      setValidationErrors(errors)
    }

    /* 
     * perform latent validation after validating, but skip if input is blank
     * or already invalid
     */
    if (props.validate && props.latentValidation && valid && input) {
      if (timeoutIndex >= 0) { window.clearTimeout(timeoutIndex) }
      setPendingValidation(true)
      props.onValidate(false)
      setTimeoutIndex(window.setTimeout(async () => {
        setPendingValidation(false)
        if (props.latentValidation && input) {
          const errors = await props.latentValidation(input)
          if (!errors.length) { props.onValidate(true) }
          setValidationErrors(errors)
        }
      }, 1500))
    } else {
      props.onValidate(valid)
    }
    return valid
  }

  const onChange = (evt: React.ChangeEvent<HTMLInputElement>) => {
    validateFieldValue(evt.target.value)
    setFieldValue(evt.target.value)
    props.onChange(evt.target.value)
  }

  /* 
   * on confirm should only check if the confirmation value is the same as the
   * regular field value 
   */
  const onConfirm = (evt: React.ChangeEvent<HTMLInputElement>) => {
    setConfirmValue(evt.target.value)
    let valid = true
    if (props.validate && props.validation && props.confirm) {
      /* 
       * get any existing validation errors and then append a new error if the
       * values don't match
       */
      const errors = props.validation(fieldValue)
      if (evt.target.value !== fieldValue) {
        errors.push('values do not match') 
      }
      valid = !errors.length
      setValidationErrors(errors)
    }
    props.onValidate(valid)
  }

  const onKeyupHandler = (evt: React.KeyboardEvent<HTMLInputElement>) => {
    if (props.onEnter && evt.keyCode === 13) {
      const isConfirm = !!evt.currentTarget.getAttribute('confirm')
      props.onEnter(fieldValue, isConfirm)
    }
  }

  const className = pendingValidation ? 'pending' : (validationErrors.length ? 'invalid' : '')
  return React.createElement(fragment ? React.Fragment : 'div', { ...!fragment && { className: classes.formField }}, [
    <div className={ classes.formLabel } key={ `label-${props.name}` }>{ props.label ? props.label : '' }</div>,
    <div className={ `${ classes.formField } ${props.confirm ? 'confirm' : ''}` } key={ `field-${props.name}` }>
      <input 
        type={ props.type ? props.type : "text" }
        className={ `form-input ${className} ${ fieldValue && props.validate && props.validation ? 'filled' : ''}` } 
        onChange={ onChange }
        value={ props.value }
        onKeyUp={ onKeyupHandler }
        { ...props.hint && { placeholder: props.hint }}
      />
      { props.confirm &&
        <input 
          type={ props.type ? props.type : "text" }  
          className={ `form-input confirm ${className} ${ fieldValue && props.validate && props.validation ? 'filled' : ''}` } 
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
        (props.validate && props.validation) && validationErrors.map((err, index) => {
          return <div className="error" key={ `${props.label}-err-${index}` }>{ err }</div>
        })
      }
    </div>
  ])
}

export default FormField
