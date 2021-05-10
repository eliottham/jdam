import JdamClient from '../client/jdam_client'
import { useEffect, useState } from 'react'
import AddIcon from '@material-ui/icons/Add'
import GroupIcon from '@material-ui/icons/Group'

import { BigAction, SlidingPageDialog, Form, FormSlider } from '../comps/comps'
import { FormFieldTemplate } from '../comps/form_field'
import { SlidingPageDialogProps } from '../comps/sliding_page_dialog'
import Validation from '../client/validation'

interface CreateSessionFormProps {
  errors?: string[]
  showErrors?: boolean
  formValid?: boolean
  setFormValid?: (valid: boolean) => void
  onSubmit: (params: { title: string, description: string, length: number }) => void
}

const fieldTemplates: FormFieldTemplate[] = [
  {
    name: 'title',
    label: 'Session Title',
    validation: Validation.validateSessionName
  },
  {
    name: 'description',
    label: 'Description',
    validation: Validation.validateSafeText
  },
  {
    name: 'length',
    label: 'Session Length',
    child: <FormSlider
      fragment={ false }
      name="length"
      min={ 10 }
      max={ 120 }
      step={ 10 }
    />
  }
]

function CreateSessionForm(props: CreateSessionFormProps): JSX.Element {

  const [ formValid, setFormValid ] = useState(false)

  const onSubmitHandler = (params: { [index: string]: string }) => {
    const { title, description, length } = params
    ;(props.setFormValid ?? setFormValid)(false)
    props.onSubmit({ title, description, length: Number(length) || 10 })
  }

  return (
    <Form
      fieldTemplates={ fieldTemplates }
      onSubmit={ onSubmitHandler }
      formValid={ props.formValid ?? formValid }
      setFormValid={ props.setFormValid ?? setFormValid }
      errors={ props.errors }
      showErrors={ props.showErrors }
    />
  )
}

export interface SessionDialogProps extends SlidingPageDialogProps {
  client: JdamClient
  onConfirm: (params: { 
    join: boolean,
    title?: string,
    description?: string,
    length?: number,
    sessionId?: string 
  }) => void
}

function SessionDialog({
  open,
  onClose,
  onConfirm,
  tabIndex,
  setTabIndex,
  ...props
}: SessionDialogProps): JSX.Element {

  const [ errors, setErrors ] = useState<string[]>([])
  const [ showErrors, setShowErrors ] = useState(false)
  const [ formValid, setFormValid ] = useState(false)

  useEffect(() => {
    let timeoutIndex = -1

    const onCreateSession = ({ errors = [] }: { errors: string[] }) => {
      setErrors(errors)
      setShowErrors(!!errors.length)
      if (errors.length) {
        if (timeoutIndex >= 0) { window.clearTimeout(timeoutIndex) }
        timeoutIndex = window.setTimeout(() => {
          setShowErrors(false)
        }, 5000)
      }
    }

    props.client.on('create-session', onCreateSession)
    return () => {
      props.client.un('create-session', onCreateSession)
      window.clearTimeout(timeoutIndex)
      if (!open) { setShowErrors(false) }
    }
  }, [ props.client, open ])


  const handleOnCreateSession = (params: { title: string, description: string, length: number }) => {
    onConfirm({ join: false, ...params })
  }

  const handleOnJoinSession = (id: string) => {
    onConfirm({ join: true, sessionId: id })
  }

  return (
    <SlidingPageDialog
      open={ open }
      onClose={ onClose }
      tabIndex={ tabIndex }
      setTabIndex={ setTabIndex } 
      { ...props }
    >
      <>
        <BigAction label="CREATE" onClick={ () => { setTabIndex(1) }}>
          <AddIcon/>
        </BigAction>
        <BigAction label="JOIN" onClick={ () => { setTabIndex(2) }}>
          <GroupIcon/>
        </BigAction>
      </>
      <CreateSessionForm
        onSubmit={ handleOnCreateSession }
        errors={ errors }
        showErrors={ showErrors }
        formValid={ formValid }
        setFormValid={ setFormValid }
      />
    </SlidingPageDialog>
  )
}

export default SessionDialog
