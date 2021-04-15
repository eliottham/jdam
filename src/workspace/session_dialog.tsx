import JdamClient from '../client/jdam_client'
import { useEffect, useState } from 'react'
import AddIcon from '@material-ui/icons/Add'
import GroupIcon from '@material-ui/icons/Group'

import { BigAction, SlidingPageDialog, Form } from '../comps/comps'
import FormField, { FormFieldTemplate } from '../comps/form_field'
import { SlidingPageDialogProps } from '../comps/sliding_page_dialog'
import Validation from '../client/validation'

interface CreateSessionFormProps {
  onSubmit: (params: { name: string, length: number }) => void
}

function CreateSessionForm(props: CreateSessionFormProps): JSX.Element {

  const [ formValid, setFormValid ] = useState(false)

  const fieldTemplates: FormFieldTemplate[] = [
    {
      name: 'name',
      label: 'Session Name',
      validation: Validation.validateSessionName
    },
    {
      name: 'length',
      label: 'Session Length',
      hint: 'MINUTES',
      validation: Validation.validateNumeric
    }
  ]

  const onSubmitHandler = (params: { [index: string]: string }) => {
    const { name, length } = params
    setFormValid(false)
    props.onSubmit({ name, length: Number(length) })
  }

  return (
    <Form
      fieldTemplates={ fieldTemplates }
      onSubmit={ onSubmitHandler }
      formValid={ formValid }
      setFormValid={ setFormValid }
    />
  )
}

export interface SessionDialogProps extends SlidingPageDialogProps {
  client: JdamClient
  onConfirm: (params: { join: boolean, name?: string, length?: number, sessionId?: string }) => void
}

function SessionDialog({
  open,
  onClose,
  onConfirm,
  tabIndex,
  setTabIndex,
  ...props
}: SessionDialogProps): JSX.Element {

  const handleOnCreateSession = (params: { name: string, length: number }) => {
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
      />
    </SlidingPageDialog>
  )
}

export default SessionDialog
