import './workspace.css'
import JdamClient from '../client/jdam_client'
import Session from '../client/session'
import { useEffect, useState } from 'react'
import {
  Drawer,
  Divider,
  List
} from '@material-ui/core'

import ProfileListItem from './profile_list_item'
import SessionListItem from './session_list_item'

function Workspace(props: { client: JdamClient }) {

  const [ activeSession, setActiveSession ] = useState<Session>()

  useEffect(() => {
    const onSetActiveSession = ({ session }: { session: Session }) => {
      setActiveSession(session)
    }

    props.client.on('active-session', onSetActiveSession)

    return () => {
      props.client.un('active-session', onSetActiveSession)
    }
  }, [ props.client ])

  return (
    <div className="workspace">
      <Drawer
        variant="permanent"
        className="workspace-drawer"
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
      </Drawer>
      <div className="content">
        Workspace
      </div>
    </div>
  )
}

export default Workspace
