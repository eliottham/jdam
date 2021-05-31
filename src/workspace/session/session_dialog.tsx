import { useEffect, useState } from 'react'
import AddIcon from '@material-ui/icons/Add'
import GroupIcon from '@material-ui/icons/Group'

import { BigAction, SlidingPageDialog, Form, FormSlider } from '../../comps/comps'
import { FormFieldTemplate, FormFieldProps } from '../../comps/form_field'
import { SlidingPageDialogProps } from '../../comps/sliding_page_dialog'

import JdamClient from '../../client/jdam_client'
import Validation from '../../client/validation'

import MetronomeEditor from './metronome_editor'

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

interface CreateSessionFormProps {
  client: JdamClient
  errors?: string[]
  showErrors?: boolean
  formValid?: boolean
  setFormValid?: (valid: boolean) => void
  onSubmit: (params: { 
    title: string,
    description: string,
    length: number,
    bpm: number,
    measures: number,
    pattern: number[]
  }) => void
  onSetHeight?: (height: number) => void
}

function CreateSessionForm(props: CreateSessionFormProps): JSX.Element {

  const [ formValid, setFormValid ] = useState(false)
  const [ scaledBpm, setScaledBpm ] = useState(120)
  const [ pattern, setPattern ] = useState<number[]>([ 2, 1, 1, 1 ])
  const [ measures, setMeasures ] = useState(2)

  const onSubmitHandler = (params: { [index: string]: string }) => {
    const { title, description, length } = params
    ;(props.setFormValid ?? setFormValid)(false)
    props.onSubmit({
      title,
      description,
      length: Number(length) || 10,
      bpm: scaledBpm,
      measures,
      pattern
    })
  }

  const onSetBpm = (scaledBpm: number) => {
    setScaledBpm(scaledBpm)
  }

  const onSetMeasures = (measures: number) => {
    setMeasures(measures)
  }

  const onSetPattern = (pattern: number[]) => {
    setPattern(pattern)
  }

  const autoHeight = (height: number) => {
    props.onSetHeight?.(height)
  }

  return (
    <Form
      fieldTemplates={ fieldTemplates.concat([
        {
          name: 'metronome',
          child: <MetronomeEditor
            bpm={ 120 }
            onSetBpm={ onSetBpm }
            onSetMeasures={ onSetMeasures }
            pattern={ [ 2, 1, 1, 1 ] }
            onSetPattern={ onSetPattern }
            metro={ props.client.metro }
          />
        } ]) 
      }
      onSubmit={ onSubmitHandler }
      submitText="Create"
      formValid={ props.formValid ?? formValid }
      setFormValid={ props.setFormValid ?? setFormValid }
      errors={ props.errors }
      showErrors={ props.showErrors }
      autoHeight={ autoHeight }
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
  const [ height, setHeight ] = useState(500)

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
      { ...props }
    >
      <>
        <BigAction label="CREATE" onClick={ () => { setTabIndex(1) } }>
          <AddIcon/>
        </BigAction>
        <BigAction label="JOIN" onClick={ () => { setTabIndex(2) } }>
          <GroupIcon/>
        </BigAction>
      </>
      <CreateSessionForm
        client={ props.client }
        onSubmit={ handleOnCreateSession }
        errors={ errors }
        showErrors={ showErrors }
        formValid={ formValid }
        setFormValid={ setFormValid }
        onSetHeight={ onSetHeight }
      />
    </SlidingPageDialog>
  )
}

export default SessionDialog
