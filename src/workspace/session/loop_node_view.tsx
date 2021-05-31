import LoopNode from '../../client/loop_node'
import { Sound } from '../../client/session'

import { 
  useEffect,
  useState,
  useRef,
  BaseSyntheticEvent,
  Fragment 
} from 'react'

import {
  Paper,
  Button
} from '@material-ui/core'
import { makeStyles } from '@material-ui/styles'

const nodeWidth = 500
const nodeHeight = 300
export { nodeWidth, nodeHeight }

const useStyles = makeStyles({
  root: {
    height: nodeHeight,
    width: nodeWidth,
    backgroundColor: 'var(--slt-grey)',
    border: '1px solid var(--primary)',
    borderRadius: '0.5em',
    display: 'grid',
    gridTemplateColumns: 'max-content 1fr',
    overflow: 'hidden'
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
        boxShadow: '0 2px 12px 0 rgb(0 0 0 / 50%)'
      },
      '& $root': {
        borderColor: 'var(--d-primary)'
      }
    }
  },
  trackOptions: {
    borderRight: '1px solid var(--lt-grey)',
    padding: 4
  },
  trackLane: {
  },
  tail: {

  }
})

interface LoopNodeViewProps {
  node: LoopNode
  selected: boolean
  onSelect?: (node:LoopNode) => void
}

function LoopNodeView({ node, selected, onSelect }: LoopNodeViewProps) {

  const classes = useStyles()
  const inputRef = useRef<HTMLInputElement>(null)

  const [ file, setFile ] = useState<File>()
  const [ fileId, setFileId ] = useState('')
  const [ sounds, setSounds ] = useState<Sound[]>(node.getSounds())

  useEffect(() => {
    /* do nothing */
    const onFileUpload = ({ fileId = '' }: { fileId?: string }) => {
      setFile(undefined)
      setFileId(fileId)
    }

    node.on('file-upload', onFileUpload)

    return () => {
      node.un('file-upload', onFileUpload)
    }
  }, [ node ])

  const handleOnClick = () => {
    onSelect?.(node)
  }

  return (
    <Paper className={ `${classes.paperMargin} ${selected ? 'selected' : ''}` } onClick={ handleOnClick }>
      <div className={ classes.root }>
        { sounds.map(sound => 
          <Fragment key={ sound.uid }>
            <div className={ classes.trackOptions }>{ sound.name }</div>
            <div className={ classes.trackLane }>
              sound visualization
            </div>
          </Fragment>
        )}
      </div>
    </Paper>
  )
}

export default LoopNodeView
