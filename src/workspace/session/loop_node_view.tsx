import LoopNode from '../../client/loop_node'
import SoundVisualization from './sound/sound_visualization'
import Sound from '../../client/sound'
import Transport from '../../client/sound_transport'
import Session from '../../client/session'

import { 
  useEffect,
  useState,
  Fragment
} from 'react'

import {
  Paper,
  Fab,
  IconButton
} from '@material-ui/core'

import Knob from '../../comps/knob'

import { makeStyles } from '@material-ui/styles'

import PlayArrowIcon from '@material-ui/icons/PlayArrow'
import StopIcon from '@material-ui/icons/Stop'
import PauseIcon from '@material-ui/icons/Pause'
import FiberManualRecordIcon from '@material-ui/icons/FiberManualRecord'
import { WaveformIcon } from '../../comps/icons'

const nodeWidth = 500
const nodeHeight = 300
const trackHeight = 100
const controlsWidth = 110
export { nodeWidth, nodeHeight, trackHeight }

const useStyles = makeStyles({
  root: {
    '--track-height': `${trackHeight}px`,
    backgroundColor: 'var(--slt-grey)',
    display: 'grid',
    gridTemplateColumns: `${controlsWidth}px 1fr`,
    overflow: 'auto',
    '& .disabled': {
      opacity: 0.5,
      pointerEvents: 'none',
      '--track-height': `${trackHeight / 2}px`
    },
    '&.transport': {
      '--track-height': `${trackHeight / 2}px`
    }
  },
  paperMargin: {
    '&.MuiPaper-root': {
      margin: 4,
      padding: 8,
      borderRadius: '1em',
      backgroundColor: 'var(--lt-grey)',
      boxShadow: '0 2px 3px 0px rgba(0,0,0,0.25)',
      transition: 'all 300ms var(--ease-out)',
      '&.selected': {
        backgroundColor: 'var(--primary)',
        boxShadow: '0 2px 12px 0 rgb(0 0 0 / 50%)',
        '& .container': {
          borderColor: 'var(--d-primary)'
        }
      },
      '& .container': {
        height: nodeHeight,
        width: nodeWidth,
        border: '1px solid var(--primary)',
        backgroundColor: 'var(--lt-grey)',
        borderRadius: '0.5em',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        justifyContent: 'stretch',
        overflow: 'hidden',
        position: 'relative',
        '& .tracks': {
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          '& $root': {
            height: '100%'
          }
        }
      }
    }
  },
  trackControls: {
    borderRight: '1px solid var(--lt-grey)',
    padding: 4,
    minHeight: 'var(--track-height)',
    minWidth: trackHeight,
    backgroundColor: 'var(--lt-grey)',
    display: 'flex',
    justifyContent: 'space-around',
    alignItems: 'center'
  },
  trackLane: {
    overflow: 'hidden',
    minHeight: 'var(--track-height)',
    '&:last-of-type': {
      borderBottom: '1px solid var(--lt-grey)'
    },
    '& canvas': {
      width: '100%',
      height: '100%'
    }
  },
  playheadContainer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    left: controlsWidth,
    pointerEvents: 'none',
    '& .playhead': {
      position: 'absolute',
      top: 0,
      bottom: 0,
      left: 0,
      width: 2,
      backgroundColor: 'var(--lt-blue)'
    }
  },
  tail: {

  }
})

interface TrackViewProps {
  node: LoopNode
  sound?: Sound
  ms?: number
  disabled?: boolean
  transportControls?: boolean
  onPlayPause?: () => void
  onStop?: () => void
  onEditSound?: () => void
  transport: Transport
  placeholder?: boolean
}

function TrackView({
  sound,
  ms,
  disabled = false,
  transportControls = false,
  onPlayPause,
  onStop,
  onEditSound,
  transport,
  placeholder = false
}: TrackViewProps): JSX.Element {

  const classes = useStyles()
  const [ playState, setPlayState ] = useState(transport.getPlayState()) 

  const [ gainValue, setGainValue ] = useState(sound?.gain ?? 1)
  const [ panValue, setPanValue ] = useState(sound?.pan ?? 0)
  const [ , setStops ] = useState(sound?.stops?.slice() || [])

  useEffect(() => {
    const onSetPan = ({ pan }: { pan: number }) => {
      setPanValue(pan)
    }

    const onSetGain = ({ gain }: { gain: number }) => {
      setGainValue(gain)
    }

    const onSetPlayState = ({ playState }: { playState: string }) => {
      setPlayState(playState)
    }

    const onSetSoundStops = ({ stops }: { stops: number[] }) => {
      setStops(stops)
    }

    sound?.on('set-pan', onSetPan)
    sound?.on('set-gain', onSetGain)
    sound?.on('set-sound-stops', onSetSoundStops)
    transport.on('set-play-state', onSetPlayState)

    return () => {
      sound?.un('set-pan', onSetPan)
      sound?.un('set-gain', onSetGain)
      sound?.un('set-sound-stops', onSetSoundStops)
      transport.un('set-play-state', onSetPlayState)
    }
  }, [ sound, transport ])

  const handleOnEditSound = () => {
    onEditSound?.()
  }

  const handleOnPlayPause = () => {
    onPlayPause?.()
  }

  const handleOnStop = () => {
    onStop?.()
  }

  const handleOnPanSet = (initValue: number, newValue: number) => {
    if (!sound) { return }
    transport.setSoundPan({ sound, pan: newValue })
  }

  const handleOnGainSet = (initValue: number, newValue: number) => {
    if (!sound) { return }
    transport.setSoundGain({ sound, gain: newValue })
  }

  const handleOnGainReset = () => {
    if (!sound) { return gainValue }
    transport.resetSoundGain({ sound })
    return sound.gain
  }

  const handleOnPanReset = () => {
    if (!sound) { return panValue }
    transport.resetSoundPan({ sound })
    return sound.pan
  }

  return (
    <Fragment>
      { !transportControls &&
        <div 
          className={ classes.trackControls + `${disabled ? ' disabled' : ''}` }
        >
          <Knob 
            value={ gainValue } 
            onChanging={ handleOnGainSet }
            onReset={ handleOnGainReset }
          />
          <Knob 
            min={ -1 }
            max = { 1 } 
            value={ panValue } 
            onChanging={ handleOnPanSet }
            onReset={ handleOnPanReset }
          />
        </div>
      }
      { transportControls &&
        <div 
          className={ classes.trackControls + `${disabled ? ' disabled' : ''}`  }
        >
          <IconButton onClick={ handleOnStop }>
            <StopIcon/> 
          </IconButton>
          <IconButton onClick={ handleOnPlayPause }>
            { playState === 'playing' ? <PauseIcon/> : <PlayArrowIcon/> }
          </IconButton>
        </div>
      }
      <div 
        className={ classes.trackLane + ' flex-center' + `${disabled ? ' disabled' : ''}`  }
      >
        { placeholder &&
          <Fab 
            onClick={ handleOnEditSound }
            color="primary"
          >
            <FiberManualRecordIcon/>
          </Fab>
        }
        { (!transportControls && !placeholder && !sound?.frames) &&
          <WaveformIcon/>
        }
        { (!transportControls && !placeholder && sound?.frames) &&
          <SoundVisualization
            style={ { flex: 1 } }
            sound={ sound }
            outline={ disabled }
            ms={ ms }
            scheduled={ true }
          />
        }
      </div>
    </Fragment>
  )
}

interface LoopNodeViewProps {
  node: LoopNode
  session: Session
  selected: boolean
  onSelect?: (node:LoopNode) => void
  transport: Transport
}

function LoopNodeView({ 
  node,
  session,
  selected,
  onSelect,
  transport 
}: LoopNodeViewProps): JSX.Element {

  const classes = useStyles()

  const [ inheritedSounds, setInheritedSounds ] = useState<Sound[]>(node.getInheritedSounds())
  const [ sounds, setSounds ] = useState<Sound[]>(node.getSounds())
  const [ playhead, setPlayhead ] = useState(0)
  const [ ms, setMs ] = useState(session.info.ms)

  useEffect(() => {
    /* do nothing */

    const onModifyNode = () => {
      const ms = session.info.ms
      setMs(ms)
      setInheritedSounds(node.getInheritedSounds())
      setSounds(node.getSounds())
    }

    const onSetPlayhead = ({ ms }: {ms: number }) => {
      setPlayhead(ms)
    }

    transport.on('set-sound-file', onModifyNode)
    transport.on('set-playhead', onSetPlayhead)
    node.on('assign-sound', onModifyNode)

    return () => {
      transport.un('set-sound-file', onModifyNode)
      transport.un('set-playhead', onSetPlayhead)
      node.un('assign-sound', onModifyNode)
    }
  }, [ session, node, transport ])

  const handleOnClick = () => {
    onSelect?.(node)
  }

  const handleOnPlayPause = () => {
    session.playPause()
  }

  const handleOnStop = () => {
    session.transport.stop()
  }

  const handleOnEditSound = () => {
    node.editNewSound()
  }

  const tracks = () => {
    const result = new Array<JSX.Element>()
    { inheritedSounds.forEach(sound =>  {
      result.push(
        <TrackView
          key={ sound.uid }
          node={ node }
          sound={ sound }
          ms={ ms }
          disabled={ true }
          transport={ transport }
        />
      )
    }
    ) }
    { sounds.forEach(sound => {
      result.push(
        <TrackView
          key={ sound.uid }
          node={ node }
          sound={ sound }
          ms={ ms }
          transport={ transport }
        />
      )
    }
    ) }
    result.push(
      <TrackView 
        key="placeholder"
        node={ node } 
        transport={ transport }
        onEditSound={ handleOnEditSound }
        placeholder={ true }
      />
    )
    return result
  }

  return (
    <Paper 
      className={ `${classes.paperMargin} ${selected ? 'selected' : ''}` } 
      onClick={ handleOnClick }
    >
      <div className="container">
        <div className="tracks">
          <div className={ classes.root }>
            { tracks() }
          </div>
        </div>
        <div className={ classes.root + ' transport' } >
          <TrackView 
            node={ node } 
            transport={ transport }
            transportControls={ true }
            onPlayPause={ handleOnPlayPause }
            onStop={ handleOnStop }
          />
        </div>
        <div className={ classes.playheadContainer } >
          <div
            className="playhead"
            style={ { left: `${100 * playhead / ms}%` } }
          />
        </div>
      </div>
    </Paper>
  )
}

export default LoopNodeView
