import React from 'react'

import JdamClient from '../../client/jdam_client'

import Button from '@material-ui/core/Button'
import Dialog from '@material-ui/core/Dialog'
import DialogActions from '@material-ui/core/DialogActions'
import DialogContent from '@material-ui/core/DialogContent'
import DialogContentText from '@material-ui/core/DialogContentText'
import DialogTitle from '@material-ui/core/DialogTitle'

function JoinSessionFromUrl({
  client,
  open,
  setOpen 
}: { 
  client: JdamClient 
  open: boolean
  setOpen: (open: boolean) => void
}): JSX.Element {

  const handleOnCancel = () => {
    setOpen(false)
  }

  const handleOnConfirm = () => {
    setOpen(false)
    client.joinSessionFromUrl()
  }

  return (
    <Dialog
      open={ open }
      onClose={ handleOnCancel }
    >
      <DialogTitle>Join new Jam Session</DialogTitle>
      <DialogContent>
        <DialogContentText>
          You have opened a link to a Jam Session that you do not have in your sessions. Would you like to join anyway?
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button 
          onClick={ handleOnCancel } 
          color="primary"
          variant="outlined"
        >
          Cancel 
        </Button>
        <Button 
          onClick={ handleOnConfirm } 
          color="primary" 
          variant="contained"
        >
          Join 
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export { JoinSessionFromUrl }
