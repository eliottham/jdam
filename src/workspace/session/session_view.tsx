import { useEffect, useState } from 'react'

import LoopNodeLane from './loop_node_lane'
import { SoundEditorDialog } from './sound/sound_editor'
import { PopupErrors } from '../../comps/comps'

import Session from '../../client/session'
import Sound from '../../client/sound'
import LoopNode from '../../client/loop_node'

import { makeStyles } from '@material-ui/styles'

const useStyles = makeStyles({
  root: {
    height: '100%',
    width: '100%',
    overflowX: 'hidden',
    overflowY: 'scroll'
  },
  popupLayer: {
    position: 'absolute',
    bottom: '0.5em',
    right: '0.5em',
    zIndex: 200
  }
})

interface SessionViewProps {
  session: Session
  setActive?: boolean
}

function SessionView({ session, setActive = false }: SessionViewProps): JSX.Element {

  const [ errors, setErrors ] = useState<string[]>([])
  const [ showErrors, setShowErrors ] = useState(false)

  const [ editingSound, setEditingSound ] = useState<Sound>()

  const classes = useStyles()

  useEffect(() => {
    let timeoutIndex = -1

    const onError = ({ errors }: { errors: string[] }) => {
      setErrors(errors)
      setShowErrors(!!errors.length)
      if (errors.length) {
        if (timeoutIndex > -1) {
          window.clearTimeout(timeoutIndex)
        }
        timeoutIndex = window.setTimeout(() => {
          setShowErrors(false)
        }, 5000)
      }
    }

    const onEditSound = ({ sound }: { sound: Sound }) => {
      setEditingSound(sound)
    }

    const onCancelEditSound = () => {
      setEditingSound(undefined)
    }

    session.on('errors', onError)
    session.on('edit-sound', onEditSound)
    session.on('cancel-edit-sound', onCancelEditSound)
    session.on('save-edit-sound', onCancelEditSound)

    return () => {
      session.un('errors', onError)
      session.un('edit-sound', onEditSound)
      session.un('cancel-edit-sound', onCancelEditSound)
      session.un('save-edit-sound', onCancelEditSound)
      window.clearTimeout(timeoutIndex)
    }
  }, [ session ])

  useEffect(() => {
    if (setActive) {
      session.setActive()
    }
  }, [ session, setActive ])

  const handleOnCloseSoundEditor = () => {
    session.cancelEditSound()
  }

  return (
    <div className={ classes.root }>
      <LoopNodeLane
        depth={ 0 }
        key="root-lane"
        rootNode={ session.rootNode } 
        session={ session } 
      />
      <SoundEditorDialog
        open={ !!editingSound }
        onClose={ handleOnCloseSoundEditor }
        session={ session }
        sound={ editingSound }
      />
      <div className={ classes.popupLayer }>
        <PopupErrors
          errors={ errors }
          showErrors={ showErrors }
        />
      </div>
    </div>
  )
}

export default SessionView
