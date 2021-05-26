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

import SessionDialog from './session_dialog'

import { makeStyles } from '@material-ui/styles'

import ProfileListItem from './profile_list_item'
import SessionListItem from './session_list_item'
import LoopNodeLane from './loop_node_lane'
import DeviceManager from './device_manager'
import People from './people'

import JdamClient from '../client/jdam_client'
import Session from '../client/session'

import { PopupErrors } from '../comps/comps'

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
  },
  popupLayer: {
    position: 'absolute',
    bottom: '0.5em',
    right: '0.5em',
    zIndex: 200
  }
})

function Workspace(props: { client: JdamClient }) {

  const classes = useStyles()

  const [ activeSession, setActiveSession ] = useState<Session>()
  const [ sessions, setSessions ] = useState<Session[]>([])
  const [ creatingSession, setCreatingSession ] = useState(false)
  const [ tabIndex, setTabIndex ] = useState(0)
  const [ errors, setErrors ] = useState<string[]>([])
  const [ showErrors, setShowErrors ] = useState(false)

  useEffect(() => {
    let timeoutIndex = -1

    const onError = ({ errors }: { errors: string[] }) => {
      setErrors(errors)
      setShowErrors(!!errors.length)
      if (errors.length) {
        if (timeoutIndex > -1) {
          window.clearTimeout(timeoutIndex)
        }
        timeoutIndex = window.setTimeout(() => {
          setShowErrors(false)
        }, 5000)
      }
    }

    const onSetActiveSession = ({ session }: { session?: Session }) => {
      if (activeSession) {
        activeSession.un('errors', onError)
      }
      setActiveSession(session)
      setCreatingSession(false)
      session?.on('errors', onError)
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

    return () => {
      props.client.un('set-sessions', onSetSessions)
      props.client.un('active-session', onSetActiveSession)
      props.client.un('cancel-create-session', onCancelCreateSession)
      window.clearTimeout(timeoutIndex)
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
    sessionId = '' 
  }: { 
    join: boolean,
    title?: string,
    description?: string,
    length?: number,
    sessionId?: string
  }) => {
    if (!join) { props.client.createSession({ title, description, sessionLength: length }) }
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
            <Link to="/people" style={{ textDecoration: 'none' }}>
              <ListItem button>
                <ListItemIcon>
                  <PeopleIcon />
                </ListItemIcon>
                <ListItemText style={{ color: 'grey' }} primary="People" />
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
          <Route exact={true} path="/">                  
            { !!activeSession && 
              <LoopNodeLane
                depth={ 0 }
                key="root-lane"
                rootNode={ activeSession.rootNode } 
                session={ activeSession } 
              />
            }
            <DeviceManager client={ props.client } />
          </Route> 
          <Route path="/people" render={ () => {
            return <People client={props.client} />
          }}>              
          </Route>
        </Switch>   
        {/* </div> */}
        <div className={ classes.popupLayer }>
          <PopupErrors
            errors={ errors }
            showErrors={ showErrors }
          />
        </div>       
      </div>
    </Router>
  )
}

export default Workspace
