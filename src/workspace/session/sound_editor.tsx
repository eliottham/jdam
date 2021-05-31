import { useState, useEffect } from 'react'

import Session from '../../client/session'
import LoopNode from '../../client/loop_node'

import { NoteIcon } from '../../comps/icons'
import SlidingPageDialog from '../../comps/sliding_page_dialog'
import BigAction from '../../comps/big_action'

import { makeStyles } from '@material-ui/styles'

import PublishIcon from '@material-ui/icons/Publish'

const useStyles = makeStyles({
  root: {
  }
})

interface SoundEditor {
  node: LoopNode
}

interface SoundEditorDialogProps {
  session: Session
  node?: LoopNode
  open: boolean
  onClose: () => void
}

function SoundEditorDialog({ session, node, open, ...props }: SoundEditorDialogProps): JSX.Element {

  const classes = useStyles()

  const [ tabIndex, setTabIndex ] = useState(0)
  const [ height, setHeight ] = useState(500)

  const onClose = () =>{
    props.onClose()
    setTabIndex(0)
  }

  return (
    <SlidingPageDialog
      open={ open }
      height={ height }
      onClose={ onClose }
      tabIndex={ tabIndex }
      setTabIndex={ setTabIndex } 
    >
      <>
        <BigAction label="UPLOAD" onClick={ () => { setTabIndex(1) } }>
          <PublishIcon/>
        </BigAction>
        <BigAction label="RECORD" onClick={ () => { setTabIndex(2) } }>
          <NoteIcon/>
        </BigAction>
      </>
    </SlidingPageDialog>
  )
}

export default SoundEditor
export {
  SoundEditorDialog
}
