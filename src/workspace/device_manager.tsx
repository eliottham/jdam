import { useEffect, useState } from 'react'
import {
  IconButton,
  Button,
  DialogProps,
  List,
  ListItem
} from '@material-ui/core'

import MicIcon from '@material-ui/icons/Mic'
import MicOffIcon from '@material-ui/icons/MicOff'

import VolumeUpIcon from '@material-ui/icons/VolumeUp'
import VolumeOffIcon from '@material-ui/icons/VolumeOff'

import VideocamIcon from '@material-ui/icons/Videocam'
import VideocamOffIcon from '@material-ui/icons/VideocamOff'

import SettingsIcon from '@material-ui/icons/Settings'

import { makeStyles } from '@material-ui/styles'

import JdamClient, { AudioDeviceType } from '../client/jdam_client'
import Session from '../client/session'

import CloseableDialog from '../comps/closeable_dialog'

const useStyles = makeStyles({
  root: {
    position: 'absolute',
    bottom: '0',
    padding: '0.5em',
    left: 240,
    right: 8,
    display: 'flex',
    justifyContent: 'flex-start',
    background: 'linear-gradient(0deg, var(--white) 10%, transparent 40%)',
    '& > .MuiButton-root': {
      margin: 4,
      minHeight: 48,
      minWidth: 48,
      color: 'var(--grey)',
      borderColor: 'var(--lt-grey)',
      backgroundColor: 'var(--white)'
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
  const [ dialogOpen, setDialogOpen ] = useState(false)

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

  const handleOnShowDialog = () => {
    setDialogOpen(true)
  }

  const handleOnClose = () => {
    setDialogOpen(false)
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
      <IconButton 
        onClick={ handleOnShowDialog } 
      >
        <SettingsIcon/>
      </IconButton>
      <DeviceSelectionDialog
        open={ dialogOpen } 
        client={ client }
        onClose={ handleOnClose }
      />
    </div>
  )
}

const useDialogStyles = makeStyles({
  root: {
    '& .MuiDialog-paper': {
      padding: '1em',
      flexDirection: 'row',
      '& > .column': {
        padding: '1em',
        '& > .title': {
          fontSize: '1.5rem',
          borderBottom: '1px solid var(--lt-grey)',
          paddingBottom: 8
        }
      }
    },
    '& .MuiListItem-root': {
      border: '1px solid transparent',
      borderWidth: '1px 1px 2px',
      borderRadius: 4,
      '&.selected': {
        position: 'relative',
        borderColor: 'var(--primary)'
      }
    }
  }
})

interface DeviceSelectionDialogProps {
  client: JdamClient
}

function DeviceSelectionDialog({ client, open, ...props }: DeviceSelectionDialogProps & DialogProps) {

  const classes = useDialogStyles()

  const [ selectedInput, setSelectedInput ] = useState(client.settings.selectedInput)
  const [ selectedOutput, setSelectedOutput ] = useState(client.settings.selectedOutput)

  useEffect(() => {
    const onSelectDevice = ({ type, deviceId }: { type: AudioDeviceType, deviceId: string}) => {
      type === 'input' ? setSelectedInput(deviceId) : setSelectedOutput(deviceId)
    }

    client.settings.on('set-selected-device', onSelectDevice)
    return () => {
      client.settings.un('set-selected-device', onSelectDevice)
    }
  }, [ client ])

  const handleOnSelect = (type: AudioDeviceType, deviceId: string) => {
    return () => {
      client.settings.setSelectedDevice({ type, deviceId })
    }
  }

  return (
    <CloseableDialog
      className={ classes.root }
      open={ open }
      maxWidth={ false }
      { ...props }
    >
      <div className="column">
        <div className="title">Inputs</div>
        <List>
          {
            client.settings.getDevices({ type: 'input' }).map(info => {
              return (
                <ListItem 
                  key={ info.deviceId }
                  button={ true }
                  className={ selectedInput === info.deviceId ? 'selected' : '' }
                  onClick={ handleOnSelect('input', info.deviceId) }
                >
                  { info.label }
                </ListItem>
              )
            })
          }
        </List>
      </div>
      <div className="column">
        <div className="title">Outputs</div>
        <List>
          {
            client.settings.getDevices({ type: 'output' }).map(info => {
              return (
                <ListItem 
                  key={ info.deviceId }
                  button={ true }
                  className={ selectedOutput === info.deviceId ? 'selected' : '' }
                  onClick={ handleOnSelect('output', info.deviceId) }
                >
                  { info.label }
                </ListItem>
              )
            })
          }
        </List>
      </div>
    </CloseableDialog>
  )
}

export default DeviceManager
export {
  DeviceSelectionDialog
}
