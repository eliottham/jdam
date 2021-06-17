import { BaseSyntheticEvent, useState, useEffect, useRef } from 'react'

import Session from '../../../client/session'
import LoopNode from '../../../client/loop_node'
import Sound, { Frames } from '../../../client/sound'

import { NoteIcon } from '../../../comps/icons'
import SlidingPageDialog from '../../../comps/sliding_page_dialog'
import BigAction from '../../../comps/big_action'

import SoundVisualization from './sound_visualization'
import StopHandle, { iconSize } from './stop_handle'

import { makeStyles } from '@material-ui/styles'

import { IconButton, Button } from '@material-ui/core'

import PublishIcon from '@material-ui/icons/Publish'
import PlayArrowIcon from '@material-ui/icons/PlayArrow'
import StopIcon from '@material-ui/icons/Stop'
import PauseIcon from '@material-ui/icons/Pause'
import { WaveformIcon } from '../../../comps/icons'

const soundVisHeight = 256

const useStyles = makeStyles({
  root: {
    minHeight: soundVisHeight,
    width: '100%',
    display: 'grid',
    gridTemplateAreas: `"vis"
                        "con"
                        "yes"`,
    gridTemplateRows: 'min-content 1fr min-content',
    position: 'relative',
    marginTop: 'auto'
  },
  vis: {
    gridArea: 'vis',
    position: 'relative',
    height: soundVisHeight,
    marginBottom: iconSize + 8,
    '& .playhead': {
      position: 'absolute',
      top: 0,
      bottom: 0,
      left: 0,
      width: 2,
      backgroundColor: 'var(--lt-blue)'
    },
    '& .sound-visualization': {
      position: 'absolute',
      height: '100%',
      width: '100%'
    },
    '& .waveform': {
      position: 'absolute',
      top: '50%',
      left: 0,
      transform: 'translate3d(0, -50%, 0)'
    },
    '& .overlay': {
      position: 'absolute',
      backgroundColor: 'rgba(var(--primary-s), 0.2)',
      borderRight: '1px solid rgba(var(--primary-s), 0.7)',
      height: '100%'
    }
  },
  transportControls: {
    gridArea: 'con',
    display: 'flex',
    justifyContent: 'center',
    '& > .MuiButtonBase-root': {
      margin: '0 1em'
    }
  },
  submitButton: {
    '&.MuiButton-root': {
      marginTop: '30px',
      gridArea: 'yes'
    }
  }
})

interface SoundEditorProps {
  sound: Sound
  session: Session
}

const clipFromStops = (session: Session, sound: Sound): string => {
  if (!sound.stops) { return '' }

  const stops = sound.stops
  const points = []
  const ms = Math.max((session.info.ms + 1000) || 0, sound.ms || 0, 1000)
  points.push(`${100 * (stops[0] / ms)}% 0%`)
  points.push(`${100 * (stops[3] / ms)}% 0%`)
  points.push(`${100 * (stops[3] / ms)}% 100%`)
  points.push(`${100 * (stops[0] / ms)}% 100%`)
  return `polygon(${points.join(',')})`
}

function SoundEditor({ sound, session }: SoundEditorProps): JSX.Element {
  /*
   * show info about the file maybe
   *
   * Editor should also have transport controls which tell session
   * to play the file with the pending edits
   */

  const ref = useRef<HTMLDivElement>(null)

  const classes = useStyles()

  const ms = Math.max((session.info.ms + 1000) || 0, sound.ms || 0, 1000)

  const [ stops, setStops ] = useState<number[]>(sound.stops?.slice() || [])
  const [ clip, setClip ] = useState(clipFromStops(session, sound))
  const [ width, setWidth ] = useState(1)
  const [ playhead, setPlayhead ] = useState(session._editorTransport.playhead)
  const [ playState, setPlayState ] = useState(session._editorTransport.getPlayState()) 
  const [ showHandles, setShowHandles ] = useState(!!sound.file)

  useEffect(() => {
    const onSetSoundFile = ({ sound }: { sound: Sound }) => {
      setStops(sound.stops.slice())
      setClip(clipFromStops(session, sound))
      setShowHandles(!!sound.file)
    }

    const onSetSoundStops = ({ stops }: { stops: number[] }) => {
      setStops(stops.slice())
      setClip(clipFromStops(session, sound))
      session._editorTransport.leadIn(stops[1])
    }

    const onSetPlayhead = ({ ms }: {ms: number }) => {
      setPlayhead(ms)
    }

    const onSetPlayState = ({ playState }: { playState: string }) => {
      setPlayState(playState)
    }

    session._editorTransport.on('set-play-state', onSetPlayState)
    session._editorTransport.on('set-playhead', onSetPlayhead)
    sound.on('set-sound-file', onSetSoundFile)
    sound.on('set-sound-stops', onSetSoundStops)

    return () => {
      session._editorTransport.un('set-play-state', onSetPlayState)
      session._editorTransport.un('set-playhead', onSetPlayhead)
      sound.un('set-sound-file', onSetSoundFile)
      sound.un('set-sound-stops', onSetSoundStops)
    }
  }, [ sound, session ])

  useEffect(() => {

    if (!ref.current) { return } 

    const current = ref.current

    const observer = new ResizeObserver(entries => {
      if (current) {
        setWidth(entries[0].contentRect.width)
      }
    })

    observer.observe(current)

    return () => {
      if (current) {
        observer.unobserve(current)
      }
    }
  }, [ width ])

  const stop = (index: number) => {
    return width * ((stops[index] || 0) / ms)
  }

  const loopOverlayStyle = () => {
    return { width: `${100 * session.info.ms / ms}%`,
      left: `${100 * stops[1] / ms}%` }
  }

  const setStop = (index: number) => {
    return (initValue: number, newValue: number) => {
      if (!sound) { return }

      const newStops = stops.slice()
      const msValue = (newValue / width) * ms
      newStops[index] = msValue
      session._editorTransport.setSoundStops({ sound, stops: newStops })
    }
  }

  const resetStop = (index: number) => {
    return (): number => {
      if (!sound) { return stops[index] }
      session._editorTransport.resetSoundStops({ sound, index })
      return stops[index] 
    }
  }

  const handleOnPlayPause = () => {
    session._editorTransport.playPause()
  }

  const handleOnStop = () => {
    session._editorTransport.stop()
  }

  const handleSaveEditSound = () => {
    session.saveEditSound()
  }

  return (
    <div 
      ref={ ref }
      className={ classes.root }
    >
      <div className={ classes.vis }>
        <div 
          className="playhead"
          style={ { left: `${100 * playhead / ms}%` } }
        />
        { !sound.frames?.length &&
          <WaveformIcon/>
        }
        { sound.frames &&
          <SoundVisualization
            className="lower"
            sound={ sound }
            ms={ ms }
            outline={ true }
            fixed={ true }
          />
        }
        { sound.frames &&
          <SoundVisualization
            className="upper"
            style={ { clipPath: clip } }
            sound={ sound }
            ms={ ms }
            gridLines={ false }
            fixed={ true }
          />
        }
        { showHandles && [
          <StopHandle
            key="stop-0"
            type="samplestart"
            x={ stop(0) } 
            max={ stop(1) }
            totalWidth={ width }
            onChanged={ setStop(0) }
            onReset={ resetStop(0) }
          />,
          <StopHandle
            key="stop-1"
            type="fadeinend"
            x={ stop(1) } 
            min={ stop(0) }
            max={ stop(2) }
            totalWidth={ width }
            onChanged={ setStop(1) }
            onReset={ resetStop(1) }
          />,
          <StopHandle
            key="stop-2"
            type="sampleend"
            x={ stop(3) } 
            min={ stop(2) }
            totalWidth={ width }
            onChanged={ setStop(3) }
            onReset={ resetStop(3) }
          />,
          <StopHandle
            key="stop-3"
            type="fadeoutstart"
            x={ stop(2) } 
            min={ stop(1) }
            max={ stop(3) }
            totalWidth={ width }
            onChanged={ setStop(2) }
            onReset={ resetStop(2) }
          />,
          <div
            key="overlay"
            className="overlay"
            style={ loopOverlayStyle() }
          />
        ]
        }
      </div>
      <div 
        className={ classes.transportControls }
      >
        <IconButton onClick={ handleOnStop }>
          <StopIcon/> 
        </IconButton>
        <IconButton onClick={ handleOnPlayPause }>
          { playState === 'playing' ? <PauseIcon/> : <PlayArrowIcon/> }
        </IconButton>
      </div>
      <Button 
        variant="contained"
        className={ classes.submitButton }
        startIcon={ <PublishIcon/> }
        onClick={ handleSaveEditSound }
      >
        UPLOAD
      </Button>
    </div>
  )
}

interface SoundEditorDialogProps {
  session: Session
  sound?: Sound
  node?: LoopNode
  open: boolean
  onClose: () => void
}

function SoundEditorDialog({ session, sound, open, ...props }: SoundEditorDialogProps): JSX.Element {

  const inputRef = useRef<HTMLInputElement>(null)

  const [ tabIndex, setTabIndex ] = useState(0)

  useEffect(() => {
    const onProcessSoundFile = () => {
      if (sound && inputRef.current) {
        inputRef.current.value = ''
      }
    }

    session.on('process-sound-file', onProcessSoundFile)

    return () => {
      session.un('process-sound-file', onProcessSoundFile)
    }
  }, [ session, sound ])

  useEffect(() => {
    if (open) { setTabIndex(0) }
  }, [ open ])

  const onClose = () =>{
    setTabIndex(0)
    props.onClose()
  }

  const onClickUpload = () => {
    inputRef.current?.click()
  }

  const handleFileChange = (event: BaseSyntheticEvent) => {
    const file = event.target.files[0]
    if (file) {
      setTabIndex(1) 
      session.processAndConvertSoundFile({ sound, file })
    } else {
      setTabIndex(0)
    }
  }

  return (
    <SlidingPageDialog
      open={ open }
      height={ 500 }
      onClose={ onClose }
      tabIndex={ tabIndex }
      setTabIndex={ setTabIndex } 
      disableBackdropClose={ true }
    >
      <>
        <BigAction label="UPLOAD" onClick={ onClickUpload }>
          <PublishIcon/>
          <input 
            ref={ inputRef }
            type="file" 
            accept="audio/*"
            style={ { display: 'none' } }
            onChange={ handleFileChange }
          />
        </BigAction>
        <BigAction label="RECORD" onClick={ () => { setTabIndex(1) } }>
          <NoteIcon/>
        </BigAction>
      </>
      { !!sound &&
        <SoundEditor
          sound={ sound }
          session={ session }
        />
      }
    </SlidingPageDialog>
  )
}

export default SoundEditor
export {
  SoundEditorDialog
}