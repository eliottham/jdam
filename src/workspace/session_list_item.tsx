import { useEffect } from 'react'
import Session from '../client/session'
import {
  ListItem
} from '@material-ui/core'

function SessionListItem(props: { session: Session }) {
  return (
    <ListItem button>
      <div>{ props.session.title }</div>
      <div>{ props.session.description }</div>
      <div>{ props.session.userCount }</div>
    </ListItem>
  )
}

export default SessionListItem
