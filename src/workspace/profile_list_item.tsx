import { useState, useEffect } from 'react'

import JdamClient from '../client/jdam_client'
import Account from '../client/account'

import AccountSettingsDialog from './account_settings_dialog'

import {
  ListItem,
  ListItemAvatar,
  ListItemText,
  Avatar,
  IconButton
} from '@material-ui/core'

import SettingsIcon from '@material-ui/icons/Settings'

function ProfileListItem({ client }: { client: JdamClient }) {
  
  const [ email, setEmail ] = useState(client.account.email)
  const [ nickname, setNickname ] = useState(client.account.nickname)
  const [ avatarId, setAvatarId ] = useState(client.account.avatarId)
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

    client.on('account-info', onAccountInfo)

    return () => {
      client.un('account-info', onAccountInfo)
    }
  }, [ client ])

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
        client={ client }
        email={ email }
        nickname={ nickname }
        avatarId={ avatarId }
      />
    </ListItem>
  )
}

export default ProfileListItem
