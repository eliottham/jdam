import LoopNode from '../client/loop_node'
import Session from '../client/session'
import { useEffect, useState } from 'react'
import {
  Paper
} from '@material-ui/core'
import { makeStyles } from '@material-ui/styles'

const useStyles = makeStyles({
  root: {
  }
})

interface LoopNodeViewProps {
  loopNode: LoopNode 
}

function LoopNodeView(props: LoopNodeViewProps) {

  const classes = useStyles()

  useEffect(() => {
    /* do nothing */
  }, [ props.loopNode ])

  return (
    <div className={ classes.root }>
    </div>
  )
}

export default LoopNodeView
