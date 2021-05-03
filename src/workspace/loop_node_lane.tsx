import { useEffect, useState } from 'react'

import { makeStyles } from '@material-ui/styles'

import { Fab } from '@material-ui/core'

import Session from '../client/session'
import LoopNode from '../client/loop_node'
import LoopNodeView from './loop_node_view'

import AddIcon from '@material-ui/icons/Add'

const useStyles = makeStyles({
  root: {
  },
  lane: {
    marginBottom: '2em',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  addButtonContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    margin: 8,
    height: 300 / 2,
    width: 500 / 2,
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

  useEffect(() => {

    const onSelectNode = ({ index }: { index: number }) => {
      setSelectedNodeIndex(index)
    }

    const onRootSetChildren = ({ children }: { children: LoopNode[] }) => {
      setChildren(children.slice())
    }

    rootNode.on('set-children', onRootSetChildren)
    rootNode.on('set-selected-node', onSelectNode)

    return () => {
      rootNode.un('set-children', onRootSetChildren)
      rootNode.un('set-selected-node', onSelectNode)
    }
  }, [ rootNode ])

  const handleOnAddNode = () => {
    rootNode?.addNode()
  }

  const selectedNode = rootNode.getSelectedNode()

  const handleOnSelect = (node: LoopNode) => {
    rootNode.setSelectedNode(rootNode.children.indexOf(node))
  }
  
  return (
    <div className={ classes.root }>
      <div className={ classes.lane }>
        { !!children.length &&
        children.map((child, index)=> {
          return <LoopNodeView
            selected={ index === selectedNodeIndex }
            key={ child.uid } 
            node={ child }
            onSelect={ handleOnSelect }
          />
        })}
        { (children.length < session.info.maxWidth && depth < session.info.maxDepth) &&
          <div 
            className={ classes.addButtonContainer }
            onClick={ handleOnAddNode }
          >
            <AddIcon/>
          </div>
        }
      </div>
      { (!!selectedNode && depth + 1 < session.info.maxDepth) &&
        <LoopNodeLane
          key={ `${selectedNodeIndex}-${selectedNode.uid}` }
          depth={ depth + 1 }
          rootNode={ selectedNode } 
          session={ session } 
        />
      }
    </div>
  )
}

export default LoopNodeLane
