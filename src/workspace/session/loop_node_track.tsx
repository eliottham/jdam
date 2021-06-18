import LoopNode from '../../client/loop_node'
import SoundVisualization from './sound/sound_visualization'
import Sound from '../../client/sound'
import Transport from '../../client/sound_transport'

import { useEffect, useState, Fragment } from 'react'

import { IconButton, Fab } from '@material-ui/core'

import Knob from '../../comps/knob'

import { makeStyles } from '@material-ui/styles'

import PlayArrowIcon from '@material-ui/icons/PlayArrow'
import StopIcon from '@material-ui/icons/Stop'
import PauseIcon from '@material-ui/icons/Pause'
import FiberManualRecordIcon from '@material-ui/icons/FiberManualRecord'
import { WaveformIcon, EditSoundIcon } from '../../comps/icons'

const nodeWidth = 500
const nodeHeight = 300
const trackHeight = 100
const controlsWidth = 110
export { nodeWidth, nodeHeight, trackHeight, controlsWidth }

const useStyles = makeStyles({
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
    },
    '& svg.edit-sound': {
      position: 'absolute',
      top: 4,
      right: 4,
      opacity: 0,
      pointerEvents: 'none',
      transform: 'translate3d(0, -4px, 0)',
      transition: 'all 150ms var(--ease-out)',
      fill: 'var(--primary)',
      cursor: 'pointer',
      '&:hover': {
        fill: 'var(--d-primary)'
      }
    },
    '&:hover svg.edit-sound': {
      opacity: 1,
      pointerEvents: 'all',
      transform: 'translate3d(0, 0, 0)'
    }
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
  onEditSound?: (sound?: Sound) => void
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
    onEditSound?.(sound)
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
          [
            <SoundVisualization
              key="vis"
              style={ { flex: 1 } }
              sound={ sound }
              outline={ disabled }
              ms={ ms }
              scheduled={ true }
            />,
            <EditSoundIcon
              key="edit"
              className="edit-sound"
              onClick={ handleOnEditSound }
            />
          ]
        }
      </div>
    </Fragment>
  )
}

export default TrackView
