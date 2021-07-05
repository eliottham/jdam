import { useEffect, useState } from 'react'

import { makeStyles } from '@material-ui/styles'

import Session from '../../client/session'
import LoopNode from '../../client/loop_node'
import LoopNodeView, { nodeWidth, nodeHeight } from './loop_node_view'

import AddIcon from '@material-ui/icons/Add'

const useStyles = makeStyles({
  root: {
    width: '100%'
  },
  lane: {
    '--index': 0,
    marginBottom: '1em',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
    height: nodeHeight + 32,
    position: 'relative',
    left: `calc(50% - ${nodeWidth / 2 + 8 + 4}px)`,
    transform: `translate3d(calc(-${nodeWidth + 24}px * var(--index)), 0, 0)`,
    transition: 'transform 500ms var(--ease-out)',
    '&.full-depth': {
      height: nodeHeight + 48
    }
  },
  addButtonContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    margin: 12,
    height: nodeHeight,
    width: nodeWidth,
    minWidth: nodeWidth,
    backgroundColor: 'var(--slt-grey)',
    border: '1px solid var(--lt-grey)',
    borderRadius: 4,
    cursor: 'pointer',
    transition: 'all 300ms var(--ease-out)',
    '&:hover': {
      backgroundColor: 'var(--lt-grey)'
    }
  }
})

interface LoopNodeLaneProps {
  session: Session
  rootNode: LoopNode
  depth: number
}

function LoopNodeLane({ session, rootNode, depth = 0 }: LoopNodeLaneProps): JSX.Element {

  const classes = useStyles()

  const [ selectedNodeIndex, setSelectedNodeIndex ] = useState(rootNode.selectedNode)
  const [ children, setChildren ] = useState<LoopNode[]>(rootNode.children)
  const [ maxWidth, setMaxWidth ] = useState(session.info.maxWidth || 4)
  const [ maxDepth, setMaxDepth ] = useState(session.info.maxDepth || 4)

  useEffect(() => {

    const onSelectNode = ({ index }: { index: number }) => {
      setSelectedNodeIndex(index)
    }

    const onRootSetChildren = ({ children }: { children: LoopNode[] }) => {
      setChildren(children.slice())
    }

    const onSetInfo = ({ info }: { info: { maxWidth: number, maxDepth: number }}) => {
      setMaxWidth(info.maxWidth)
      setMaxDepth(info.maxDepth)
    }

    setChildren(rootNode.children)
    setSelectedNodeIndex(rootNode.selectedNode)

    rootNode.on('set-children', onRootSetChildren)
    rootNode.on('set-selected-node', onSelectNode)
    session.on('set-info', onSetInfo)

    return () => {
      rootNode.un('set-children', onRootSetChildren)
      rootNode.un('set-selected-node', onSelectNode)
      session.un('set-info', onSetInfo)
    }
  }, [ rootNode, session ])

  const handleOnAddNode = () => {
    rootNode?.addNode()
  }

  const selectedNode = rootNode.getSelectedNode()

  const canAdd = children.length < maxWidth && depth < maxDepth 

  return (
    <div className={ classes.root }>
      <div 
        className={ classes.lane + ((!selectedNode || depth + 1 >= maxDepth) ? ' full-depth' : '') }
        style={ { '--index': selectedNodeIndex } as React.CSSProperties }
      >
        { !!children.length &&
        children.map((child, index)=> {
          return <LoopNodeView
            selected={ index === selectedNodeIndex }
            key={ `${session.sessionId}-${child.uid}` } 
            node={ child }
            session={ session }
            transport={ session.transport }
          />
        })}
        { canAdd &&
          <div 
            className={ classes.addButtonContainer }
            onClick={ handleOnAddNode }
          >
            <AddIcon/>
          </div>
        }
      </div>
      { (!!selectedNode && depth + 1 < maxDepth) &&
        <LoopNodeLane
          key={ `${session.sessionId}-${selectedNodeIndex}-${selectedNode.uid}` }
          depth={ depth + 1 }
          rootNode={ selectedNode } 
          session={ session } 
        />
      }
    </div>
  )
}

export default LoopNodeLane
