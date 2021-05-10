import LoopNode from '../client/loop_node'
import Session from '../client/session'
import { useEffect, useState } from 'react'
import {
  Paper
} from '@material-ui/core'
import { makeStyles } from '@material-ui/styles'

const useStyles = makeStyles({
  root: {
    height: 300,
    width: 500,
    backgroundColor: 'var(--slt-grey)',
    border: '1px solid var(--primary)',
    borderRadius: '0.5em'
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
        { props.node.uid }
      </div>
    </Paper>
  )
}

export default LoopNodeView
