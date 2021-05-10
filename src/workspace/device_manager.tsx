import { useEffect, useState } from 'react'
import {
  IconButton,
  Button
} from '@material-ui/core'
import MicIcon from '@material-ui/icons/Mic'
import MicOffIcon from '@material-ui/icons/MicOff'

import VolumeUpIcon from '@material-ui/icons/VolumeUp'
import VolumeOffIcon from '@material-ui/icons/VolumeOff'

import VideocamIcon from '@material-ui/icons/Videocam'
import VideocamOffIcon from '@material-ui/icons/VideocamOff'

import SettingsIcon from '@material-ui/icons/Settings'

import { makeStyles } from '@material-ui/styles'

import JdamClient from '../client/jdam_client'
import Session from '../client/session'

const useStyles = makeStyles({
  root: {
    position: 'absolute',
    bottom: '1em',
    width: '100%',
    display: 'flex',
    justifyContent: 'center',
    '& > .MuiButton-root': {
      margin: 4,
      minHeight: 48,
      minWidth: 48,
      color: 'var(--grey)',
      borderColor: 'var(--lt-grey)'
    }
  }
})

interface DeviceManagerProps {
  client: JdamClient
}

function DeviceManager({ client }: DeviceManagerProps) {

  const classes = useStyles()

  const [ muted, setMuted ] = useState(client.settings.muted)
  const [ vidMuted, setVidMuted ] = useState(client.settings.vidMuted)
  const [ deafened, setDeafened ] = useState(client.settings.deafened)

  useEffect(() => {
    const onSetSoundSettings = ({ 
      muted,
      deafened,
      vidMuted 
    }: { 
      muted: boolean,
      deafened: boolean,
      vidMuted: boolean
    }) => {
      setMuted(muted)
      setDeafened(deafened)
      setVidMuted(vidMuted)
    }

    client.settings.on('set-sound-settings', onSetSoundSettings)

    return () => {
      client.settings.un('set-sound-settings', onSetSoundSettings)
    }
  }, [ client ])

  const handleOnMute = () => {
    client.settings.toggleMuted()
  }

  const handleOnVidMute = () => {
    client.settings.toggleVidMuted()
  }

  const handleOnDeafen = () => {
    client.settings.toggleDeafened()
  }

  return (
    <div className={ classes.root }>
      <Button variant="outlined" onClick={ handleOnMute }>
        { (deafened || muted) ? <MicOffIcon/> : <MicIcon/> }
      </Button>
      <Button variant="outlined" onClick={ handleOnVidMute }>
        { vidMuted ? <VideocamOffIcon/> : <VideocamIcon/> }
      </Button>
      <Button variant="outlined" onClick={ handleOnDeafen }>
        { deafened ? <VolumeOffIcon/> : <VolumeUpIcon/> }
      </Button>
      <IconButton>
        <SettingsIcon/>
      </IconButton>
    </div>
  )
}

export default DeviceManager
