import React, {
  useEffect, 
  useState 
} from 'react'
import {ListItem} from '@material-ui/core'

import { makeStyles } from '@material-ui/styles'

import Session from '../client/session'

const activeIndicatorWidth = 4

const useStyles = makeStyles({
  root: {
    '&.MuiListItem-root': {
      color: 'var(--black)',
      display: 'block',
      position: 'relative',
      marginTop: 1,
      width: 'unset',
      '& .title': {
        fontSize: '1.1rem'
      },
      '&.active': {
        marginLeft: activeIndicatorWidth,
        backgroundColor: 'rgba(var(--primary-s), 0.2)',
        '&::before': {
          content: '""',
          backgroundColor: 'var(--primary)',
          position: 'absolute',
          top: 0,
          left: -activeIndicatorWidth,
          width: activeIndicatorWidth,
          bottom: 0
        }
      }
    }
  }
})

function SessionListItem({ session, active = false }: { session: Session, active?: boolean }) {

  const classes = useStyles()

  const [ numAccounts, setNumAccounts ] = useState(session.accounts.size)

  useEffect(() => {
    const onSetAccounts = ({ accounts }: { accounts: string[] }) => {
      setNumAccounts(accounts.length)
    }

    session.on('set-accounts', onSetAccounts)

    return () => {
      session.un('set-accounts', onSetAccounts)
    }
  }, [ session ])

  const handleOnClick = () => {
    session.setActive()
  }

  return (
    <ListItem 
      button 
      className={ `${classes.root} ${active ? 'active' : ''}` }
      onClick={ handleOnClick }
    >
      <div>
        <div className="title">{ session.title }</div>
        <div>{ session.description }</div>
        <div>{ numAccounts }</div>
      </div>
    </ListItem>
  )
}

export default SessionListItem
