import JdamClient from '../client/jdam_client'
import Session from '../client/session'
import { useEffect, useState } from 'react'
import AddIcon from '@material-ui/icons/Add'
import GroupIcon from '@material-ui/icons/Group'

import { BigAction, SlidingPageDialog } from '../comps/comps'
import { SlidingPageDialogProps } from '../comps/sliding_page_dialog'

import { makeStyles } from '@material-ui/styles'

const useStyles = makeStyles({
  gridForm: {
    display: 'grid',
    gridTemplateColumns: 'max-content 1fr',
    gridGap: '0.5em'
  }
})


export interface SessionDialogProps extends SlidingPageDialogProps {
  client: JdamClient
  onConfirm: (params: { join: boolean, name: string, length: number }) => void
}

function SessionDialog({
  open,
  onClose,
  tabIndex,
  setTabIndex,
  ...props
}: SessionDialogProps): JSX.Element {
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
    </SlidingPageDialog>
  )
}

export default SessionDialog
