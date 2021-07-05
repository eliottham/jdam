import { useEffect, useState } from 'react'

import Session from '../../client/session'
import Sound from '../../client/sound'

import SoundAssigner from './sound_assigner'

import { makeStyles } from '@material-ui/styles'

import { 
  Drawer,
  Divider,
  List,
  ListItem,
  IconButton
} from '@material-ui/core/'

import ChevronLeftIcon from '@material-ui/icons/ChevronLeft'

import { EditSoundIcon } from '../../comps/icons'

const useStyles = makeStyles({
  drawer: {
    '&.MuiDrawer-root': {
      width: 240
    }
  },
  paper: {
    '&.MuiPaper-root': {
      width: 240,
      position: 'absolute',
      display: 'flex',
      padding: '0 0.5em',
      boxShadow: '0 0 24px 0 rgb(0 0 0 / 10%)'
    },
    '& .MuiListItem-root': {
      padding: '1em 0.5em'
    }
  },
  listTitle: {
    '&.MuiListItem-root': {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      height: 72
    }
  },
  listItem: {
    '&.MuiListItem-root': {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      height: 50
    },
    '& svg': {
      color: 'var(--primary)',
      cursor: 'pointer',
      marginRight: 12,
      '&:hover': {
        color: 'var(--d-primary)'
      }
    },
    '& .label': {
    },
    '& .sub-label': {
      color: 'var(--grey)',
      fontSize: '10px'
    }
  },
  assigner: {
    '& > svg': {
      color: 'var(--lt-blue)',
      cursor: 'crosshair'
    },
    '&:hover > svg': {
      color: 'var(--d-blue)'
    }
  }
})

interface SoundInfoProps {
  sound: Sound
  session: Session
}

function SoundInfo({ sound, session }: SoundInfoProps): JSX.Element {

  const classes = useStyles()

  const handleOnEditSound = () => {
    session.editSound({ sound })
  }

  return (
    <ListItem
      className={ classes.listItem }
    >
      <div style={ { marginRight: 'auto' } }>
        <div className="label">{ sound.name }</div>
        { !sound.ownerNode && <div className="sub-label">NO NODE</div> }
      </div>
      { !sound.ownerNode &&
        <SoundAssigner
          className={ classes.assigner }
          session={ session }
          sound={ sound }
        />
      }
      <EditSoundIcon
        onClick={ handleOnEditSound }
      />
    </ListItem>
  )
}

interface SoundsDrawerProps { 
  session: Session
  open: boolean
  onClose?: () => void
}

function SoundsDrawer({ session, open, onClose }: SoundsDrawerProps): JSX.Element {

  const classes = useStyles()

  const [ sounds, setSounds ] = useState<Sound[]>(Array.from(session.sounds.values()))

  useEffect(() => {
    const onSetSounds = ({ sounds }: { sounds: Sound[] }) => {
      setSounds(sounds)
    }

    session.on('set-sounds', onSetSounds) 

    return () => {
      session.un('set-sounds', onSetSounds) 
    }
  })

  const handleOnClose = () => {
    onClose?.()
  }

  return (
    <Drawer
      open={ open }
      variant="persistent"
      className={ classes.drawer }
      transitionDuration={ 400 }
      classes={ {
        paper: classes.paper
      } }
    >
      <List>
        <ListItem className={ classes.listTitle }>
          Sounds
          <IconButton onClick={ handleOnClose }>
            <ChevronLeftIcon/>
          </IconButton>
        </ListItem>
        <Divider/>
        { sounds.map(sound => {
          return (
            <SoundInfo
              key={ sound.uid }
              sound={ sound }
              session={ session }
            />
          )
        })
        }
      </List>
    </Drawer>
  )
}

export default SoundsDrawer
