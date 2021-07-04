import { BaseSyntheticEvent, useState, useEffect, useRef } from 'react'

import Session from '../../../client/session'
import LoopNode from '../../../client/loop_node'
import Sound, { Frames } from '../../../client/sound'
import Transport from '../../../client/sound_transport'

import { NoteIcon } from '../../../comps/icons'
import SlidingPageDialog from '../../../comps/sliding_page_dialog'
import CloseableDialog from '../../../comps/closeable_dialog'
import BigAction from '../../../comps/big_action'
import FormField from '../../../comps/form_field'
import Validation from '../../../client/validation'
import ChargeButton from '../../../comps/charge_button'

import SoundVisualization from './sound_visualization'
import StopHandle, { iconSize } from './stop_handle'

import { makeStyles } from '@material-ui/styles'

import { IconButton, Button } from '@material-ui/core'

import PublishIcon from '@material-ui/icons/Publish'
import PlayArrowIcon from '@material-ui/icons/PlayArrow'
import StopIcon from '@material-ui/icons/Stop'
import PauseIcon from '@material-ui/icons/Pause'
import DeleteIcon from '@material-ui/icons/Delete'
import FiberManualRecordIcon from '@material-ui/icons/FiberManualRecord'
import { WaveformIcon } from '../../../comps/icons'

const soundVisHeight = 256

const useStyles = makeStyles({
  root: {
    minHeight: soundVisHeight,
    width: '100%',
    display: 'grid',
    gridTemplateAreas: `"labl field"
                        "vis   vis"
                        "con   con"
                        "trash yes"`,
    gridTemplateRows: 'min-content min-content 1fr min-content',
    gridTemplateColumns: 'max-content auto',
    position: 'relative',
    padding: '24px 2px 2px',
    overflow: 'hidden'
  },
  vis: {
    gridArea: 'vis',
    position: 'relative',
    height: soundVisHeight,
    marginBottom: iconSize + 8,
    marginTop: 8,
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
      marginTop: 10,
      gridArea: 'trash / trash / yes / yes',
      '&.save-button': {
        gridArea: 'yes'
      }
    }
  },
  deleteButton: {
    '&.charge-button': {
      borderRadius: 4,
      marginTop: 10,
      marginRight: 4,
      minWidth: 126,
      gridArea: 'trash',
      color: 'cyan',
      transition: 'all 300ms var(--ease-out)',
      boxShadow: '0 1px 2px 1px var(--lt-grey)',
      backgroundColor: 'var(--white)',
      '&.charge-button::before': {
        backgroundColor: 'var(--red)'
      },
      '& svg': {
        mixBlendMode: 'difference'
      },
      '&.charged svg': {
        mixBlendMode: 'normal',
        color: 'white',
        zIndex: 100
      },
      '&.charged': {
        transform: 'translate3d(0, -2px, 0)',
        boxShadow: '0 3px 2px 1px var(--lt-grey)'
      }
    }
  },
  editor: {
    '& .MuiPaper-root': {
      minWidth: 680,
      minHeight: 500,
      padding: '1em'
    }
  },
  recordButton: {
    '&.recording.MuiIconButton-root': {
      backgroundColor: 'var(--red)',
      color: 'white'
    }
  }
})

interface SoundEditorProps {
  sound: Sound
  session: Session
  transport: Transport
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

function SoundEditor({ sound, session, transport }: SoundEditorProps): JSX.Element {
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
  const [ playhead, setPlayhead ] = useState(transport.playhead)
  const [ playState, setPlayState ] = useState(transport.getPlayState()) 
  const [ showHandles, setShowHandles ] = useState(!!sound.frames?.length)
  const [ soundName, setSoundName ] = useState(sound.name)
  const [ frames, setFrames ] = useState(!!sound.frames?.length)
  const [ soundMs, setSoundMs ] = useState(ms)
  const [ recording, setRecording ] = useState(transport.playState === 'recording')

  useEffect(() => {
    const onSetSoundFile = ({ sound }: { sound: Sound }) => {
      setStops(sound.stops.slice())
      setClip(clipFromStops(session, sound)),
      setShowHandles(!!sound.frames?.length)
    }

    const onSetSoundFrames = ({ frames }: { frames: Frames }) => {
      setFrames(!!frames.length)
    }

    const onSetSoundMs = ({ ms }: { ms: number }) => {
      const msValue = Math.max((session.info.ms + 1000) || 0, ms || 0, 1000)
      setSoundMs(msValue)
    }

    const onSetSoundStops = ({ stops }: { stops: number[] }) => {
      setStops(stops.slice())
      setClip(clipFromStops(session, sound))
      transport.leadIn(stops[1])
    }

    const onSetPlayhead = ({ ms }: {ms: number }) => {
      setPlayhead(ms)
    }

    const onSetPlayState = ({ playState }: { playState: string }) => {
      setPlayState(playState)
    }

    const onSetSoundName = ({ name }: { name: string }) => {
      setSoundName(name)
    }

    const onUpdateSound = ({ sound }: { sound: Sound }) => {
      onSetSoundName({ name: sound.name })
    }

    const onStartRecording = () => {
      setRecording(true)
      setShowHandles(false)
      setClip('')
    }

    const onStopRecording = () => {
      setRecording(false)
      setShowHandles(!!sound.frames?.length)
    }

    transport.on('set-play-state', onSetPlayState)
    transport.on('set-playhead', onSetPlayhead)
    transport.on('start-recording', onStartRecording)
    transport.on('stop-recording', onStopRecording)
    sound.on('set-sound-file', onSetSoundFile)
    sound.on('set-sound-stops', onSetSoundStops)
    sound.on('set-sound-name', onSetSoundName)
    sound.on('update-sound', onUpdateSound)
    sound.on('set-sound-frames', onSetSoundFrames)
    sound.on('set-sound-ms', onSetSoundMs)

    return () => {
      transport.un('set-play-state', onSetPlayState)
      transport.un('set-playhead', onSetPlayhead)
      transport.un('start-recording', onStartRecording)
      transport.un('stop-recording', onStopRecording)
      sound.un('set-sound-file', onSetSoundFile)
      sound.un('set-sound-stops', onSetSoundStops)
      sound.un('set-sound-name', onSetSoundName)
      sound.un('update-sound', onUpdateSound)
      sound.un('set-sound-frames', onSetSoundFrames)
      sound.un('set-sound-ms', onSetSoundMs)
    }
  }, [ sound, session, transport ])

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
    return width * ((stops[index] || 0) / soundMs)
  }

  const loopOverlayStyle = () => {
    return { width: `${100 * session.info.ms / soundMs}%`,
      left: `${100 * stops[1] / soundMs}%` }
  }

  const setStop = (index: number) => {
    return (initValue: number, newValue: number) => {
      if (!sound) { return }

      const newStops = stops.slice()
      const msValue = (newValue / width) * soundMs
      newStops[index] = msValue
      transport.setSoundStops({ sound, stops: newStops })
    }
  }

  const resetStop = (index: number) => {
    return (): number => {
      if (!sound) { return stops[index] }
      transport.resetSoundStops({ sound, index })
      return stops[index] 
    }
  }

  const handleOnPlayPause = () => {
    transport.playPause()
  }

  const handleOnRecord = () => {
    session.toggleRecording()
  }

  const handleOnStop = () => {
    transport.stop()
  }

  const handleSaveEditSound = () => {
    session.saveEditSound()
  }
  
  const handleDeleteSound = () => {
    session.deleteEditSound()
  }

  const handleChangeSoundName = (newValue: string) => {
    transport.setSoundName({ sound, name: newValue })
  }

  const existingSound = session.sounds.has(sound.uid)

  const onSetPlayhead = (initValue: number, newValue: number) => {
    const msValue = (newValue / width) * soundMs
    transport.setPlayhead(msValue)
  }

  const onResetPlayhead = () => {
    transport.setPlayhead(0)
    return 0
  }

  return (
    <div 
      ref={ ref }
      className={ classes.root }
    >
      <FormField
        fragment={ true }
        name="name"
        label="Sound Name"
        fieldValue={ soundName }
        setFieldValue={ setSoundName }
        validation={ Validation.validateSafeText }
        onChange={ handleChangeSoundName }
      />
      <div className={ classes.vis }>
        { !frames &&
          <WaveformIcon/>
        }
        { frames &&
          <SoundVisualization
            className="lower"
            sound={ sound }
            ms={ soundMs }
            outline={ true }
            fixed={ true }
          />
        }
        { frames &&
          <SoundVisualization
            className="upper"
            style={ { clipPath: clip } }
            sound={ sound }
            ms={ soundMs }
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
        <StopHandle
          type="playhead"
          x={ width * (playhead / soundMs) } 
          totalWidth={ width }
          onChanged={ onSetPlayhead }
          onReset={ onResetPlayhead }
        />
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
        { sound.canRecord &&
          <IconButton 
            className={ `${classes.recordButton} ${recording ? 'recording' : ''}` }
            onClick={ handleOnRecord }>
            <FiberManualRecordIcon/>
          </IconButton>
        }
      </div>
      <Button 
        variant="contained"
        className={ `${classes.submitButton} ${existingSound ? 'save-button' : ''}` }
        startIcon={ <PublishIcon/> }
        onClick={ handleSaveEditSound }
      >
        { existingSound ? 'SAVE' : 'UPLOAD' }
      </Button>
      { existingSound &&
        <ChargeButton
          className={ classes.deleteButton }
          onConfirm={ handleDeleteSound }
        >
          <DeleteIcon/>
        </ChargeButton>
      }
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

function SoundEditorDialog({ session, sound, node, open, ...props }: SoundEditorDialogProps): JSX.Element {

  const classes = useStyles()

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

  const handleOnRecord = () => {
    session.editNewSound({ node, record: true })
  }

  if (sound && session.sounds.has(sound.uid)) {
    return (
      <CloseableDialog
        open={ open }
        onClose={ onClose }
        disableBackdropClose={ true }
        className={ classes.editor }
      >
        <SoundEditor
          sound={ sound }
          session={ session }
          transport={ session._editorTransport }
        />
      </CloseableDialog>
    )
  } else {
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
          <BigAction label="RECORD" onClick={ () => { 
            setTabIndex(1) 
            handleOnRecord()
          } }>
            <NoteIcon/>
          </BigAction>
        </>
        { !!sound &&
          <SoundEditor
            sound={ sound }
            session={ session }
            transport={ session._editorTransport }
          />
        }
      </SlidingPageDialog>
    )
  }
}

export default SoundEditor
export {
  SoundEditorDialog
}
