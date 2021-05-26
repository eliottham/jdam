import JdamClient from '../client/jdam_client'
import { BaseSyntheticEvent, useEffect, useState } from 'react'
import { FormFieldTemplate, FormFieldProps } from '../comps/form_field'
import { makeStyles } from '@material-ui/core/styles'
import { Avatar, Button, Dialog, DialogProps } from '@material-ui/core'
import CloseIcon from '@material-ui/icons/Close'
import Form from '../comps/form'
import Validation from '../client/validation'

const useStyles = makeStyles(theme => ({
  uploadAvatar: {
    position: 'relative',
    display: 'flex',
    border: '1px solid var(--grey)',
    background: 'var(--slt-grey)',
    marginBottom: '1em',
    borderRadius: 4,
    width: '100%',
    height: '15em',
    gridColumn: '1/span 2',
    alignItems: 'center',
    justifyContent: 'center',
    '& .avatar': {
      width: theme.spacing(20),
      height: theme.spacing(20),
      marginRight: '5em'
    },
    '& .MuiButton-root': {
      width: '15em'
    }
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between'
  },
  title: {
    color: 'var(--primary)',
    fontSize: '1.5rem',
    fontVariant: 'all-small-caps'
  },
  closeButton: {
    height: 24,
    width: 24,
    fontSize: 24,
    color: 'var(--primary)',
    cursor: 'pointer'
  }
}))

interface UploadAvatarFormFieldProps extends FormFieldProps<File> {
  avatarId?: string
}

function UploadAvatar({ avatarId, onChange }: UploadAvatarFormFieldProps): JSX.Element {
  const classes = useStyles()

  const handleChange = (event: BaseSyntheticEvent) => {
    const file = event.target.files[0]
    onChange?.(file)
  }

  const extraProps = {} as { src?: string }
  if (avatarId) {
    extraProps.src = `avatars/${avatarId}` 
  }
  return (
    <div className={ classes.uploadAvatar }>
      <Avatar className="avatar" { ...extraProps } />
      <input 
        id="upload-avatar"
        type="file" 
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleChange}
      />
      <label htmlFor="upload-avatar">
        <Button variant="contained" component="span">
          Upload Avatar
        </Button>
      </label>
    </div>
  )
}

export interface AccountSettingsDialogProps extends DialogProps {
    client: JdamClient,
    email: string,
    nickname: string,
    avatarId?: string,
    onClose: () => void
}

function AccountSettingsDialog({
  open,
  onClose,
  client,
  email,
  nickname,
  ...props
}: AccountSettingsDialogProps): JSX.Element {
  const [ errors, setErrors ] = useState<string[]>([])
  const [ showErrors, setShowErrors ] = useState(false)
  const [ formFields, setFormFields ] = useState<{ [index: string]: string }>({ email: '', nickname: '' })
  
  const classes = useStyles()

  useEffect(() => {
    setFormFields({
      email,
      nickname
    })
  }, [ email, nickname ])

  useEffect(() => {
    let timeoutIndex = -1

    const onSetAvatarId = ({ errors }: { errors: string[] }) => {
      setErrors(errors)
      setShowErrors(!!errors.length)
      if (errors.length) {
        if (timeoutIndex >= 0) { window.clearTimeout(timeoutIndex) }
        timeoutIndex = window.setTimeout(() => {
          setShowErrors(false)
        }, 5000)
      }
    }

    client.on('set-avatar-id', onSetAvatarId )

    return () => {
      client.un('set-avatar-id', onSetAvatarId)
      window.clearTimeout(timeoutIndex)
    }
  }, [ client ])

  const handleAvatarChange = (file: File) => {
    client.uploadAvatar(file)
  }

  const handleOnSubmit = ({ email, nickname, currentPassword, newPassword }: { email?: string, nickname?: string, currentPassword?: string, newPassword?: string }) => {
    client.updateAccountSettings({ email, nickname, currentPassword, newPassword })
  }

  const fieldTemplates: FormFieldTemplate[] = [
    {
      name: 'avatar',      
      child: 
        <UploadAvatar 
          avatarId={ props.avatarId }
          fragment={ true } 
          name="uploadAvatar" 
          onChange={ handleAvatarChange }
        />
    },
    {
      name: 'email',
      label: 'Email',
      validation: Validation.validateEmail
    },
    {
      name: 'nickname',
      label: 'Nickname',
      validation: Validation.validateNickname
    },
    {
      name: 'currentPassword',
      label: 'Current Password',
      type: 'password'
    },
    {
      name: 'newPassword',
      label: 'New Password',
      type: 'password',
      confirm: true,
      hint: 'New Password',
      validation: Validation.validatePassword
    }
  ]

  return (
    <Dialog
      open={ open }
      onClose={ onClose }
      PaperProps={{
        style: {
          padding: '15px'
        }
      }}
    >
      <div className={ classes.header }>     
        <div className={ classes.title }>
          Settings
        </div>
        <div className={ classes.closeButton } onClick={ onClose }>
          <CloseIcon/>
        </div>
      </div>
      <Form
        fieldTemplates={ fieldTemplates }
        formValid={ true }
        formFields={ formFields }
        setFormFields={ setFormFields }
        errors={ errors }
        showErrors={ showErrors }
        onSubmit={ handleOnSubmit }
      />
    </Dialog>
  )
}

export default AccountSettingsDialog