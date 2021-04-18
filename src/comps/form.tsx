import { useState, useRef, RefObject } from 'react'
import { 
  Button,
  Card
} from '@material-ui/core'
import { CSSTransition } from 'react-transition-group'
import FormField, { FormFieldTemplate } from './form_field'

import { makeStyles } from '@material-ui/styles'

const useStyles = makeStyles({
  form: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    '& .grid-wrapper': {
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      flex: 1,
      paddingTop: 24,
      '& .grid': {
        display: 'grid',
        gridTemplateColumns: 'max-content 1fr',
        gridGap: '0.5em'
      }
    }
  },
  authError: {
    fontSize: '1.1rem',
    color: 'var(--red)'
  },
  errors: {
    '&.MuiCard-root': {
      padding: '1em',
      color: 'white',
      backgroundColor: 'var(--red)',
      borderRadius: 4,
      margin: '12px 24px',
      transition: 'all 500ms var(--ease-out)',
      overflow: 'hidden',
      boxSizing: 'content-box',
      '& $authError': {
        color: 'white'
      }
    },
    '&.enter': {
      margin: '0 24px',
      padding: '0 1em'
    },
    '&.enter-active, &.exit': {
      margin: '12px 24px',
      padding: '1em'
    },
    '&.exit-active': {
      margin: '0 24px',
      padding: '0 1em'
    }
  }
})

interface FormProps { 
  fieldTemplates: FormFieldTemplate[]
  onSubmit?: (params: { [index: string]: string }) => void 
  errors?: string[]
  showErrors?: boolean
  submitText?: string
  noSubmit?: boolean
  children?: React.ReactChild[]
  formValid?: boolean
  setFormValid?: (valid: boolean) => void
  formFields?: { [index: string]: string }
  setFormFields?: (fields: { [index: string]: string }) => void
}

function Form( { noSubmit = false, ...props }: FormProps ): JSX.Element {

  const classes = useStyles()

  /* keep track of field values for submission */
  const [ formFields, setFormFields ] = useState<{ [index: string]: string }>({
    ...props.fieldTemplates.reduce<{ [index: string]: string }>((ob, temp) => { ob[temp.name] = ''; return ob }, {})
  })

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

  const errorsRef = useRef<HTMLDivElement>(null)

  const handleSubmit = () => {
    props.onSubmit?.({
      ...props.formFields ?? formFields
    })
  }

  function* _child() {
    let index = 0
    const childArray = React.Children.toArray(props.children)

    while (index < childArray.length) {
      const currentIndex = index
      index++
      yield childArray[currentIndex]
    }
  }

  const _childGen = _child()

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
    if (template.child) { 
      const result = _childGen.next()
      if (!result.done) { 
        return React.cloneElement(result.value as JSX.Element, {
          onValidate: handleFieldValidate,
          onEnter: handleEnter
        }) 
      }
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

  /* CSSTransition updates */
  const heightZero = (ref: RefObject<HTMLDivElement>) => {
    if (!ref.current) return
    ref.current.style.height = '0'
  }
  const heightToContent = (ref: RefObject<HTMLDivElement>) => {
    if (!ref.current) return
    ref.current.style.height = `${(ref.current.children[0] as HTMLDivElement).offsetHeight}px`
  }
  const heightUnset = (ref: RefObject<HTMLDivElement>) => {
    if (!ref.current) return
    ref.current.style.height = ''
  }

  return (
    <div className={ classes.form }>
      <div className="grid-wrapper">
        <div className="grid">
          { createFields() } 
        </div>
      </div>
      <CSSTransition
        in={ !!props.showErrors }
        nodeRef={ errorsRef }
        timeout={ 500 }
        unmountOnExit={ true }
        onEnter={()=>heightZero(errorsRef)}
        onEntering={()=>heightToContent(errorsRef)}
        onEntered={()=>heightUnset(errorsRef)}
        onExit={()=>heightToContent(errorsRef)}
        onExiting={()=>heightZero(errorsRef)}
      >
        <Card className={ classes.errors } ref={ errorsRef }>
          <div>
            { 
              props.errors?.map((err, index) => {
                return <div key={ `auth-err-${index}` } className={ classes.authError }>{ err }</div>
              })
            }
          </div>
        </Card>
      </CSSTransition>
      { !noSubmit &&
        <Button 
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
