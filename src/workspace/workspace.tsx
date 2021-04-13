import JdamClient from '../client/jdam_client'
import Session from '../client/session'
import { useEffect, useState } from 'react'
import {
  Drawer,
  Divider,
  List,
  Fab
} from '@material-ui/core'
import AddIcon from '@material-ui/icons/Add'
import GroupIcon from '@material-ui/icons/Group'

import SessionDialog from './session_dialog'

import { makeStyles } from '@material-ui/styles'

import ProfileListItem from './profile_list_item'
import SessionListItem from './session_list_item'

const drawerWidth = 240

const useStyles = makeStyles({
  workspace: {
    display: 'flex',
    alignItems: 'stretch',
    height: '100%',
    '& > .content': {
      flex: 1,
      display: 'flex',
      flexDirection: 'column'
    }
  },
  workspaceDrawer: {
    width: drawerWidth,
    '& > .MuiPaper-root': {
      boxShadow: '0 0 24px 0 rgba(0,0,0,0.1)',
      width: drawerWidth,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center'
    }
  }
})


function Workspace(props: { client: JdamClient }) {

  const classes = useStyles()

  const [ activeSession, setActiveSession ] = useState<Session>()
  const [ creatingSession, setCreatingSession ] = useState(false)
  const [ tabIndex, setTabIndex ] = useState(0)

  useEffect(() => {
    const onSetActiveSession = ({ session }: { session: Session }) => {
      setActiveSession(session)
    }

    const onCancelCreateSession = () => {
      setCreatingSession(false)
    }

    props.client.on('active-session', onSetActiveSession)
    props.client.on('cancel-create-session', onCancelCreateSession)

    return () => {
      props.client.un('active-session', onSetActiveSession)
      props.client.un('cancel-create-session', onCancelCreateSession)
    }
  }, [ props.client ])

  const handleOnCreateSession = () => {
    setCreatingSession(true)
  }

  const handleOnSubmitSession = ({ join = false, name, length }: { join: boolean, name: string, length: number }) => {
    if (!join) { props.client.createSession({ name, sessionLength: length }) }
  }

  const handleOnCloseSessionDialog = () => {
    setCreatingSession(false)
    setTabIndex(0)
  }

  return (
    <div className={ classes.workspace }>
      <Drawer
        variant="permanent"
        className={ classes.workspaceDrawer } 
      >
        <List>
          <ProfileListItem client={ props.client }/> 
          <Divider/>
          {
            props.client.getSessions().map((session, index) => {
              return <SessionListItem key={ `session-${index}` } session={ session }/>
            })
          }
        </List>
        <Fab color="primary" onClick={ handleOnCreateSession }>
          <AddIcon/>
        </Fab>
        <SessionDialog 
          client={ props.client }
          open={ creatingSession }
          tabIndex={ tabIndex }
          setTabIndex={ setTabIndex }
          onClose={ handleOnCloseSessionDialog }
          onConfirm={ handleOnSubmitSession }
        />
      </Drawer>
      <div className="content">
        Workspace
      </div>
    </div>
  )
}

export default Workspace
