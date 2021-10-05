import React, { useEffect } from 'react'

import JdamClient from '../client/jdam_client'
import {
  BaseSyntheticEvent,
  useState,
  useRef 
} from 'react'
import { makeStyles } from '@material-ui/styles'
import {
  Avatar,
  Button,
  DialogProps 
} from '@material-ui/core'
import AccountSettingsForm, { 
  AvatarFormField,
  AvatarFormFieldParams 
} from 'client/forms/account_settings_form'
import { 
  ConfirmTextFormFieldDisplay,
  FormFieldDisplayProps,
  TextFormFieldDisplay 
} from 'comps/form_field'
import FormDisplay from 'comps/form'
import CloseableDialog from 'comps/closeable_dialog'
import { TextFormField } from 'client/forms/form'

const useStyles = makeStyles({
  root: {
    '& .MuiPaper-root': {
      padding: '1em'
    }
  },
  uploadAvatar: {
    position: 'relative',
    display: 'flex',
    border: '1px solid var(--grey)',
    background: 'var(--slt-grey)',
    marginBottom: '1em',
    padding: '1em',
    borderRadius: 4,
    width: '100%',
    gridColumn: '1 / span 2',
    alignItems: 'center',
    justifyContent: 'space-around',
    '& .avatar': {
      width: 250,
      height: 250,
      marginRight: '1em'
    },
    '& .MuiButton-root': {
      width: 200
    }
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between'
  },
  title: {
    color: 'var(--primary)',
    fontSize: '1.5rem',
    fontVariant: 'all-small-caps',
    padding: '4px 16px'
  },
  closeButton: {
    height: 24,
    width: 24,
    fontSize: 24,
    color: 'var(--primary)',
    cursor: 'pointer'
  }
})

function UploadAvatarDisplay({ model }: FormFieldDisplayProps<AvatarFormFieldParams>): JSX.Element {
  
  const classes = useStyles()
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (event: BaseSyntheticEvent) => {
    const file = event.target.files[0]
    model.setValue({
      file,
      ...model.getValue()
    })
  }

  const extraProps = {} as { src?: string }
  const avatarId = model.getValue()?.avatarId
  if (avatarId) {
    extraProps.src = `avatars/${avatarId}`
  }

  const onClickUpload = () => {
    inputRef.current?.click()
  }

  return (
    <div className={ classes.uploadAvatar }>
      <Avatar className="avatar" { ...extraProps } />
      <input 
        ref={ inputRef }
        type="file" 
        accept="image/*"
        style={ { display: 'none' } }
        onChange={ handleFileChange }
      />
      <Button 
        onClick={ onClickUpload }
        variant="contained" 
        component="span"
      >
        Upload Avatar
      </Button>
    </div>
  )
}

export interface AccountSettingsDialogProps extends DialogProps {
    open: boolean,
    client: JdamClient,
    onClose: () => void
}

function AccountSettingsDialog({
  open,
  onClose,
  client
}: AccountSettingsDialogProps): JSX.Element {

  const [ model, setModel ] = useState(new AccountSettingsForm({ client }))

  useEffect(() => {
    const onAccountInfo = () => {
      setModel(new AccountSettingsForm({ client }))
    }

    client.on('account-info', onAccountInfo)
    return () => {
      client.un('account-info', onAccountInfo)
    }
  }, [ client ])

  const classes = useStyles()

  return (
    <CloseableDialog
      open={ open }
      onClose={ onClose }
    >
      <div className={ classes.header }>     
        <div className={ classes.title }>
          Settings
        </div>
      </div>
      <FormDisplay
        model={ model }
        submitText="SAVE" 
      >
        <UploadAvatarDisplay
          model={ model.getField('avatar') as AvatarFormField }
        />
        <TextFormFieldDisplay
          fragment
          label="Email"
          model={ model.getField('email') as TextFormField }
        />
        <TextFormFieldDisplay
          fragment
          label="Nickname"
          model={ model.getField('nickname') as TextFormField }
        />
        <TextFormFieldDisplay
          fragment
          label="Current Password"
          model={ model.getField('currentPassword') as TextFormField }
          type="password"
        />
        <ConfirmTextFormFieldDisplay
          fragment
          label="New Password"
          hint="Confirm New Password"
          model={ model.getField('newPassword') as TextFormField }
          confirmModel={ model.getField('confirmNewPassword') as TextFormField }
          type="password"
        />
      </FormDisplay>
    </CloseableDialog>
  )
}

export default AccountSettingsDialog
