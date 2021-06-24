import JdamClient from '../../client/jdam_client'

import { useState } from 'react'

import React from 'react'
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

interface JoinSessionProps {
  client: JdamClient
}

function JoinSession({ client }: JoinSessionProps): JSX.Element {

  

  /* create a wrapped debounce function */
  const debounce = (fn: (evt: React.ChangeEvent<HTMLInputElement>) => void, delay = 500) => {
    let timeoutId: number

    return (evt: React.ChangeEvent<HTMLInputElement>) => {
      window.clearTimeout(timeoutId)
      timeoutId = window.setTimeout(() => {
        fn(evt)
      }, delay)
    }
  }

  return (
    <div>
    </div>
  )
}

export default JoinSession
