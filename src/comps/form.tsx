import React from 'react'
import { useState, useRef, useLayoutEffect } from 'react'
import { Button } from '@material-ui/core'
import FormField, { FormFieldTemplate, FormFieldProps } from './form_field'
import PopupErrors from './popup_errors'

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
  fieldTemplates: FormFieldTemplate[]
  onSubmit?: (params: { [index: string]: string }) => void 
  submitText?: string
  noSubmit?: boolean
  children?: FormFieldProps
  formValid?: boolean
  setFormValid?: (valid: boolean) => void
  formFields?: { [index: string]: string }
  setFormFields?: (fields: { [index: string]: string }) => void
  errors?: string[]
  showErrors?: boolean
  autoHeight?: (height: number) => void
}

function Form( { noSubmit = false, ...props }: FormProps ): JSX.Element {

  const classes = useStyles()

  /* keep track of field values for submission */
  const [ formFields, setFormFields ] = useState<{ [index: string]: string }>({
    ...props.fieldTemplates.reduce<{ [index: string]: string }>((ob, temp) => { ob[temp.name] = ''; return ob }, {})
  })

  const formRef = useRef<HTMLDivElement>(null)

  /* keep track of field validity separately 
   *
   * this is useful for latent
   * validation that queries the server for additional information
   * 
   * this is also useful for confirmation fields which don't update the
   * value directly, but only update the validity based on matching
   */
  const [ formFieldsValid, setFormFieldsValid ] = useState<{ [index: string]: boolean }>({
    ...props.fieldTemplates.reduce<{ [index: string]: boolean }>((ob, temp) => { ob[temp.name] = !temp.validation; return ob }, {})
  })

  const [ formValid, setFormValid ] = useState(true)

  useLayoutEffect(() => {
    if (props.autoHeight) {
      const rect = formRef.current?.getBoundingClientRect()
      if (rect) {
        props.autoHeight?.(Math.ceil(rect.height) + 32)
      }
    }
  })

  const handleSubmit = () => {
    props.onSubmit?.({
      ...props.formFields ?? formFields
    })
  }

  /* create a form field and setup all it's handlers */
  const _field = (template: FormFieldTemplate, last: boolean): JSX.Element => {
    const handleFieldChange = (input: string) => {
      const newFields = { ...props.formFields ?? formFields }
      newFields[template.name] = input
      ;(props.setFormFields ?? setFormFields)(newFields)
    }

    const handleEnter = () => {
      last && handleSubmit()
    }

    const handleFieldValidate = (valid: boolean) => {
      const newValidFields = { ...formFieldsValid }
      if (template.validation) {
        newValidFields[template.name] = valid
        setFormFieldsValid(newValidFields)
      }
      let formValid = true
      for (const template of props.fieldTemplates) { 
        const fieldName = template.name
        if (template.validation) { formValid = formValid && newValidFields[fieldName] }
      }
      if (props.setFormValid) { props.setFormValid(formValid) }
      else { setFormValid(formValid) }
    }

    /* 
     * check if the template is meant to substitute in a child element from the
     * existing list of children
     */
    if (React.isValidElement(template.child)) { 
      const child = React.cloneElement(template.child, {
        validate: true,
        key: `field-${template.name}`,
        fieldValue: (props.formFields ?? formFields)[template.name],
        setFieldValue: handleFieldChange,
        fragment: true,
        onEnter: handleEnter,
        onValidate: handleFieldValidate,
        ...template,
        confirm: template.confirm
      }, [])

      return child
 
    } 

    return <FormField 
      validate={ true }
      key={ `field-${template.name}` } 
      fieldValue={ (props.formFields ?? formFields)[template.name] }
      setFieldValue={ handleFieldChange }
      fragment={ true } 
      onEnter={ handleEnter }
      onValidate={ handleFieldValidate }
      { ...template } 
      confirm={ template.confirm }
    />
  }

  const createFields = () => {
    return (
      <>
        {
          props.fieldTemplates.map((template, index, arr) => {
            return _field(template, index === arr.length - 1)
          })
        }
      </>
    )
  }

  return (
    <div className={ classes.form } ref={ formRef }>
      <div className="grid-wrapper">
        <div className="grid">
          { createFields() } 
        </div>
      </div>
      <PopupErrors
        errors={ props.errors }
        showErrors={ props.showErrors }
      />
      { !noSubmit &&
        <Button 
          className={ classes.launchButton }
          onClick={ handleSubmit } 
          variant="contained" 
          disabled={ !(props.formValid ?? formValid) }
        >
          { props.submitText || 'Submit' }
        </Button>
      }
    </div>
  )

}

export default Form
