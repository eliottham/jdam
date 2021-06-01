import { useState, useEffect } from 'react'
import JdamClient from '../client/jdam_client'
import {
  ListItem,
  ListItemAvatar,
  ListItemText,
  Avatar,
  IconButton
} from '@material-ui/core'
import SettingsIcon from '@material-ui/icons/Settings'
import AccountSettingsDialog from './account_settings_dialog'
import Account from '../client/account'

function ProfileListItem(props: { client: JdamClient }) {
  
  const [ email, setEmail ] = useState(props.client.email)
  const [ nickname, setNickname ] = useState(props.client.nickname)
  const [ avatarId, setAvatarId ] = useState(props.client.avatarId)
  const [ openAccountSettings, setOpenAccountSettings ] = useState(false)

  const handleOnOpenAccountSettings = () => {
    setOpenAccountSettings(true)
  }

  const handleOnCloseAccountSettings = () => {
    setOpenAccountSettings(false)
  }

  useEffect(() => {
    const onAccountInfo = ({ account }: { account: Account }) => {
      setEmail(account.email)
      setNickname(account.nickname)
      setAvatarId(account.avatarId)
    }

    props.client.on('account-info', onAccountInfo)

    return () => {
      props.client.un('account-info', onAccountInfo)
    }
  }, [])

  const extraProps = {} as { src?: string }
  if (avatarId) {
    extraProps.src = `avatars/${avatarId}` 
  }

  return (
    <ListItem className="profile-li">
      <ListItemAvatar>
        <Avatar { ...extraProps }/>
      </ListItemAvatar>
      <ListItemText primary={ nickname } secondary = { email }/>
      <IconButton onClick={ handleOnOpenAccountSettings }>
        <SettingsIcon/>
      </IconButton>
      <AccountSettingsDialog
        open={ openAccountSettings }
        onClose={ handleOnCloseAccountSettings }
        client={ props.client }
        email={ email }
        nickname={ nickname }
        avatarId={ avatarId }
      />
    </ListItem>
  )
}

export default ProfileListItem
