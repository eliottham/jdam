import LoopNode from '../client/loop_node'
import Session from '../client/session'
import { useEffect, useState } from 'react'
import {
  Paper
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
    gridTemplateColumns: 'max-content 1fr'
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
    backgroundColor: 'var(--lt-grey)',
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

function LoopNodeView(props: LoopNodeViewProps) {

  const classes = useStyles()

  useEffect(() => {
    /* do nothing */
  }, [ props.node ])

  const handleOnClick = () => {
    props.onSelect?.(props.node)
  }

  return (
    <Paper className={ `${classes.paperMargin} ${props.selected ? 'selected' : ''}` } onClick={ handleOnClick }>
      <div className={ classes.root }>
        <div className={ classes.trackOptions }>track 1</div>
        <div className={ classes.trackLane }>sound visualization</div>
      </div>
    </Paper>
  )
}

export default LoopNodeView
