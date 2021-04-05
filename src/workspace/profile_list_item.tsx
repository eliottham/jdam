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

function ProfileListItem(props: { client: JdamClient }) {

  const [ username, setUsername ] = useState(props.client.username)
  const [ nickname, setNickname ] = useState(props.client.nickname)

  useEffect(() => {
    const onAccountInfo = ({ username, nickname }: { username: string, nickname: string }) => {
      setUsername(username)
      setNickname(nickname)
    }

    props.client.on('account-info', onAccountInfo)

    return () => {
      props.client.un('account-info', onAccountInfo)
    }
  }, [])

  return (
    <ListItem className="profile-li">
      <ListItemAvatar>
        <Avatar/>
      </ListItemAvatar>
      <ListItemText primary={ nickname } secondary = { username }/>
      <IconButton>
        <SettingsIcon/>
      </IconButton>
    </ListItem>
  )
}

export default ProfileListItem
