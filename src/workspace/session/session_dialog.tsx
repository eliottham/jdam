import React, { useState } from 'react'

import AddIcon from '@material-ui/icons/Add'
import GroupIcon from '@material-ui/icons/Group'

import {
  BigAction,
  SlidingPageDialog,
  FormDisplay,
  FormSliderDisplay
} from 'comps/comps'
import { TextFormFieldDisplay } from 'comps/form_field'
import { SlidingPageDialogProps } from 'comps/sliding_page_dialog'

import JdamClient from 'client/jdam_client'

import MetronomeEditor from './metronome_editor'
import SessionCreateForm, { MetronomeFormField } from 'client/forms/session_create_form'
import { 
  NumberFormField,
  TextFormField
} from 'client/forms/form'

interface CreateSessionFormProps {
  client: JdamClient
  onSetHeight?: (height: number) => void
}

function CreateSessionForm({
  client,
  onSetHeight
}: CreateSessionFormProps): JSX.Element {

  const [ model ] = useState(new SessionCreateForm({ client }))

  const autoHeight = (height: number) => {
    onSetHeight?.(height)
  }

  return (
    <FormDisplay
      model={ model }
      submitText="Create"
      autoHeight={ autoHeight }
    >
      <TextFormFieldDisplay
        fragment
        model={ model.getField('title') as TextFormField }
        label="Title"
      />
      <TextFormFieldDisplay
        fragment
        model={ model.getField('description') as TextFormField }
        label="Description"
      />
      <FormSliderDisplay
        fragment
        model={ model.getField('length') as NumberFormField } 
        label="Length"
      />
      <MetronomeEditor
        model={ model.getField('metronome_editor') as MetronomeFormField }
      />
    </FormDisplay>
  )
}

export interface SessionDialogProps extends SlidingPageDialogProps {
  client: JdamClient
}

function SessionDialog({
  open,
  onClose,
  tabIndex,
  setTabIndex,
  ...props
}: SessionDialogProps): JSX.Element {

  const [ height, setHeight ] = useState(500)

  const onSetHeight = (height: number) => {
    setHeight(Math.max(500, height))
  }

  return (
    <SlidingPageDialog
      open={ open }
      height={ height }
      onClose={ onClose }
      tabIndex={ tabIndex }
      setTabIndex={ setTabIndex }
      disableBackdropClose={ true }
      { ...props }
    >
      <>
        <BigAction
          label="CREATE"
          onClick={ () => {
            setTabIndex(1)
          } }
        >
          <AddIcon />
        </BigAction>
        <BigAction
          label="JOIN"
          onClick={ () => {
            setTabIndex(2)
          } }
        >
          <GroupIcon />
        </BigAction>
      </>
      <CreateSessionForm
        client={ props.client }
        onSetHeight={ onSetHeight }
      />
      <div/>
    </SlidingPageDialog>
  )
}

export default SessionDialog
