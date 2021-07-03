import LoopNode from '../../client/loop_node'
import Sound from '../../client/sound'
import Transport from '../../client/sound_transport'
import Session from '../../client/session'

import { useEffect, useState, useRef } from 'react'

import { Paper } from '@material-ui/core'


import { makeStyles } from '@material-ui/styles'

import TrackView, { trackHeight, controlsWidth } from './loop_node_track'

const nodeWidth = 500
const nodeHeight = 300
export { nodeWidth, nodeHeight }

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

  /* 
   * using a ref here to forcefully-avoid redraws of the canvas element in the
   * visualization component 
   */
  const playheadRef = useRef<HTMLDivElement>(null)

  const [ inheritedSounds, setInheritedSounds ] = useState<Sound[]>(node.getInheritedSounds())
  const [ sounds, setSounds ] = useState<Sound[]>(node.getSounds())
  const [ ms, setMs ] = useState(session.info.ms)

  useEffect(() => {
    /* do nothing */

    const onModifyNode = () => {
      const ms = session.info.ms
      setMs(ms)
      setInheritedSounds(node.getInheritedSounds())
      setSounds(node.getSounds())
    }

    const onSetPlayhead = ({ ms: playhead }: {ms: number }) => {
      if (!playheadRef.current) { return }
      playheadRef.current.style.left = `${100 * playhead / ms}%`
    }

    transport.on('set-playhead', onSetPlayhead)
    transport.on('set-sound-file', onModifyNode)
    session.on('update-sound', onModifyNode)
    session.on('set-sounds', onModifyNode)
    node.on('assign-sound', onModifyNode)

    return () => {
      transport.un('set-playhead', onSetPlayhead)
      transport.un('set-sound-file', onModifyNode)
      session.un('update-sound', onModifyNode)
      session.un('set-sounds', onModifyNode)
      node.un('assign-sound', onModifyNode)
    }
  }, [ session, node, transport, ms ])

  const handleOnClick = () => {
    onSelect?.(node)
  }

  const handleOnPlayPause = () => {
    session.playPause(node.uid)
  }

  const handleOnStop = () => {
    session.transport.stop()
  }

  const handleOnEditSound = (sound?: Sound) => {
    if (!sound) {
      node.editNewSound()
    } else {
      node.editSound({ sound })
    }
  }

  const tracks = () => {
    let alreadyUploaded = false
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
      /* wow I hate this */
      alreadyUploaded = alreadyUploaded || sound.accountId === session.client.account.id
      result.push(
        <TrackView
          key={ sound.uid }
          node={ node }
          sound={ sound }
          ms={ ms }
          transport={ transport }
          onEditSound={ handleOnEditSound }
        />
      )
    }
    ) }
    if (!alreadyUploaded) {
      result.push(
        <TrackView 
          key="placeholder"
          node={ node } 
          transport={ transport }
          onEditSound={ handleOnEditSound }
          placeholder={ true }
        />
      )
    }
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
            ref={ playheadRef }
            className="playhead"
            style={ { left: 0 } }
          />
        </div>
      </div>
    </Paper>
  )
}

export default LoopNodeView
