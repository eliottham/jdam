import React, { SyntheticEvent } from 'react'
import {
  Dialog,
  DialogProps
} from '@material-ui/core'

import CloseButton from './close_button'

export interface CloseableDialogProps extends DialogProps { 
  disableBackdropClose?: boolean
}

function CloseableDialog({ disableBackdropClose = false, children, ...props }: CloseableDialogProps) {

  const handleOnClose = (evt: SyntheticEvent<HTMLElement>, reason: 'backdropClick' | 'escapeKeyDown' ) => {
    if (disableBackdropClose) { return }
    props.onClose?.(evt, reason) 
  }

  return (
    <Dialog
      { ...props }
      onClose={ handleOnClose }
    >
      <CloseButton onClick={ () => { props.onClose?.({}, 'backdropClick') } }/> 
      { children }
    </Dialog>
  )
}

export default CloseableDialog
