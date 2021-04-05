import './comps.css'
import React, { useState, useEffect } from 'react'

function FormField({ fragment = false, ...props }: {
    fragment: boolean,
    name: string,
    value?: string,
    label?: string,
    type?: string,
    validate?: boolean,
    confirm?: boolean,
    validation?: (input: string) => string[],
    latentValidation?: (input: string) => Promise<string[]>
    onChange: (newValue: string) => void,
    onValidate: (valid: boolean) => void,
    onEnter?: (value: string, confirm: boolean) => void
  }): JSX.Element {

  const [ validationErrors, setValidationErrors ] = useState<string[]>([])
  const [ fieldValue, setFieldValue ] = useState('')
  const [ confirmValue, setConfirmValue ] = useState('')
  const [ timeoutIndex, setTimeoutIndex ] = useState(-1)

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
    if (props.validate && props.validation) {
      const errors = props.validation(input)
      if (props.confirm && input !== confirmValue) {
        errors.push('values do not match') 
      }
      valid = !errors.length
      setValidationErrors(errors)
    }
    if (props.validate && props.latentValidation && valid && input) {
      if (timeoutIndex >= 0) { window.clearTimeout(timeoutIndex) }
      setTimeoutIndex(window.setTimeout(async () => {
        if (props.latentValidation && input) {
          const errors = await props.latentValidation(input)
          props.onValidate(!errors.length)
          setValidationErrors(errors)
        }
      }, 1500))
    }
    props.onValidate(valid)
    return valid
  }

  const onChange = (evt: React.ChangeEvent<HTMLInputElement>) => {
    validateFieldValue(evt.target.value)
    setFieldValue(evt.target.value)
    props.onChange(evt.target.value)
  }

  const onConfirm = (evt: React.ChangeEvent<HTMLInputElement>) => {
    setConfirmValue(evt.target.value)
    let valid = true
    if (props.validate && props.validation && props.confirm) {
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

  return React.createElement(fragment ? React.Fragment : 'div', { ...!fragment && {className: "form-field" }}, [
    <div className="form-label" key={ `label-${props.name}` }>{ props.label ? props.label : '' }</div>,
    <div className={ `form-field ${props.confirm ? 'confirm' : ''}` } key={ `field-${props.name}` }>
      <input 
        type={ props.type ? props.type : "text" }
        className={ `form-input ${ validationErrors.length ? 'invalid' : ''} ${ fieldValue && props.validate ? 'filled' : ''}` } 
        onChange={ onChange }
        value={ props.value }
        onKeyUp={ onKeyupHandler }
      />
      { props.confirm &&
        <input 
          type={ props.type ? props.type : "text" }  
          className={ `form-input confirm ${ validationErrors.length ? 'invalid' : ''} ${ fieldValue && props.validate ? 'filled' : ''}` } 
          onChange={ onConfirm } 
          placeholder={ `Confirm ${props.label}` }
          onKeyUp={ onKeyupHandler }
          { ...{confirm: 'confirm'}}
        />
      }
      { 
        props.validate && validationErrors.map((err, index) => {
          return <div className="error" key={ `${props.label}-err-${index}` }>{ err }</div>
        })
      }
    </div>
  ])
}

function Icon({ iconSize = 24, ...props }: { url: string, iconSize?: number, className?: string }): JSX.Element {
  return (
    <svg
      className={`icon ${props.className || ''}`}
      viewBox={`0 0 ${iconSize} ${iconSize}`}
    >
      <use href={props.url}/>
    </svg>
  )
}

export {
  FormField,
  Icon
}
