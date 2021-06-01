import { useEffect, useState } from 'react'
import {
  Drawer,
  Divider,
  List,
  Fab,
  ListItem,
  ListItemText,
  ListItemIcon
} from '@material-ui/core'
import AddIcon from '@material-ui/icons/Add'
import PeopleIcon from '@material-ui/icons/People'

import {
  BrowserRouter as Router,
  Switch,
  Route,
  Link
} from "react-router-dom"

import SessionDialog from './session/session_dialog'
import SessionView from './session/session_view'

import { makeStyles } from '@material-ui/styles'

import ProfileListItem from './profile_list_item'
import SessionListItem from './session_list_item'
import DeviceManager from './device_manager'
import People from './people'

import JdamClient from '../client/jdam_client'
import Session from '../client/session'

const drawerWidth = 240

const useStyles = makeStyles({
  workspace: {
    display: 'flex',
    alignItems: 'stretch',
    height: '100%',
    '& > .content': {
      flex: 1,
      display: 'flex',
      position: 'relative',
      overflowY: 'scroll',
      overflowX: 'hidden'
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
  const [ sessions, setSessions ] = useState<Session[]>([])
  const [ creatingSession, setCreatingSession ] = useState(false)
  const [ tabIndex, setTabIndex ] = useState(0)

  useEffect(() => {
    const onSetActiveSession = ({ session }: { session?: Session }) => {
      setActiveSession(session)
      setCreatingSession(false)
    }

    const onSetSessions = ({ sessions }: { sessions: Session[] }) => {
      setSessions(sessions)
    }

    const onCancelCreateSession = () => {
      setCreatingSession(false)
    }

    props.client.on('set-sessions', onSetSessions)
    props.client.on('active-session', onSetActiveSession)
    props.client.on('cancel-create-session', onCancelCreateSession)

    let activityTimerId = -1
    
    const onActivity = () => {
      props.client.bounce()
      activityTimerId = window.setTimeout(() => {
        window.addEventListener('mousemove', onActivity, { once: true }) 
      }, 5 * 1000 * 60)
    }

    window.addEventListener('mousemove', onActivity, { once: true }) 

    return () => {
      props.client.un('set-sessions', onSetSessions)
      props.client.un('active-session', onSetActiveSession)
      props.client.un('cancel-create-session', onCancelCreateSession)
      window.removeEventListener('mousemove', onActivity) 
      window.clearTimeout(activityTimerId)
    }
  }, [ props.client ])


  const handleOnCreateSession = () => {
    setCreatingSession(true)
  }

  const handleOnSubmitSession = ({ 
    join = false,
    title = '',
    description = '',
    length,
    sessionId = '',
    bpm = 120,
    pattern = [ 2, 1, 1, 1 ]
  }: { 
    join: boolean,
    title?: string,
    description?: string,
    length?: number,
    sessionId?: string,
    bpm?: number,
    pattern?: number[]
  }) => {
    if (!join) { 
      props.client.createSession({ 
        title,
        description,
        sessionLength: length,
        bpm,
        pattern
      })
    }
    else { props.client.joinSession({ sessionId }) }
  }

  const handleOnCloseSessionDialog = () => {
    setCreatingSession(false)
    setTabIndex(0)
  }

  return (
    <Router>
      <div className={ classes.workspace }>
        <Drawer
          variant="permanent"
          className={ classes.workspaceDrawer } 
        >
          <List>
            <ProfileListItem client={ props.client }/> 
            <Divider/>
            <Link to="/people" style={ { textDecoration: 'none' } }>
              <ListItem button>
                <ListItemIcon>
                  <PeopleIcon />
                </ListItemIcon>
                <ListItemText style={ { color: 'grey' } } primary="People" />
              </ListItem>
            </Link>
            {
              sessions.map(session => {
                return <SessionListItem 
                  active={ session === activeSession } 
                  key={ `session-${session.sessionId}` } 
                  session={ session }
                />
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
        {/* <div className="content">  */}
        <Switch>
          <Route exact={ true } path="/">                  
            { !!activeSession && 
          <SessionView
            session={ activeSession }
          />
            }
            <DeviceManager client={ props.client } />
          </Route> 
          <Route path="/people" render={ () => {
            return <People client={ props.client } />
          } }>              
          </Route>
        </Switch>   
      </div>
    </Router>
  )
}

export default Workspace
