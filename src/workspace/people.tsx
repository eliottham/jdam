import JdamClient from '../client/jdam_client'
import { useEffect, useState } from 'react'
import { makeStyles } from '@material-ui/styles'
import SearchIcon from '@material-ui/icons/Search'
import PersonAddIcon from '@material-ui/icons/PersonAdd'
import PeopleIcon from '@material-ui/icons/People'
import ChatIcon from '@material-ui/icons/Chat'
import {
  ListItem,
  ListItemAvatar,
  ListItemText,
  Avatar,
  IconButton,
  TextField,
  InputAdornment,
  Tooltip
} from '@material-ui/core'


import Account, { Friend } from '../client/account'

const useStyles = makeStyles({
  people: {
    paddingTop: '20px',
    width: '100%',
    display: 'flex',
    justifyContent: 'flex-start',
    flexDirection: 'column'
  },
  searchBar: {
    width: '50%',
    alignSelf: 'center'
  },
  searchInput: {    
    height: 35
  },
  accountList: {
    alignSelf: 'center',
    width: '50%',
    paddingTop: '2em'
  },
  pending: {
    '&.MuiSvgIcon-root': {
      animation: '1s infinite alternate $pending-friend-request'
    }
  },
  '@keyframes pending-friend-request': {
    '0%': {
      color: 'var(--d-primary)'
    },
    '100%': {
      color: 'var(--primary)'
    }
  }
})


function People({ client }: { client: JdamClient }): JSX.Element {

  const classes = useStyles()

  const [ accounts, setAccounts ] = useState<Account[]>([])
  const [ friends, setFriends ] = useState<Friend[]>(client.account.friends.slice() || [])

  useEffect(() => {
    const onSetAccounts = (dbAccounts: Account[]) => {
      setAccounts(dbAccounts)
    }
    client.on('search-accounts', onSetAccounts)

    const onAccountInfo = ({ account }: { account: Account }) => {
      setFriends(account.friends)
    }

    client.on('account-info', onAccountInfo)

    return () => {
      client.un('search-accounts', onSetAccounts)
      client.un('account-info', onAccountInfo)
    }
  }, [ client ])

  /* create a wrapped debounce function */
  const debounce = (fn: (evt: React.ChangeEvent<HTMLInputElement>) => void, delay = 500) => {
    let timeoutId: number

    return (evt: React.ChangeEvent<HTMLInputElement>) => {
      window.clearTimeout(timeoutId)
      timeoutId = window.setTimeout(() => {
        fn(evt)
      }, delay)
    }
  }

  const handleSearchOnChange = debounce((e) => {
    client.findAccounts(e.target.value)
  })

  const generateAccountList = (accounts: Account[]) => {

    const _removeFriend = (targetFriend: Account) => {
      client.removeFriend(targetFriend)
    }

    const _sendFriendRequest = (targetFriend: Account) => {
      client.sendFriendRequest(targetFriend)
    }  

    const _generateFriendButton = (targetAccount: Account) => {
      const friend = friends.find(f => f.id === targetAccount.id)
      if (friend) {
        if (friend.pending) {
          return (
            <Tooltip title="Request pending">
              <IconButton onClick={ () => _removeFriend(targetAccount) }>
                <PersonAddIcon className={ classes.pending } />
              </IconButton>
            </Tooltip>
          )
        } else {
          return (
            <Tooltip title="Remove friend">
              <IconButton onClick={ () => _removeFriend(targetAccount) }>
                <PeopleIcon color="primary" />
              </IconButton>
            </Tooltip>
          )
        }
      } else {
        return (
          (
            <Tooltip title="Add friend">
              <IconButton onClick={ () => _sendFriendRequest(targetAccount) }>
                <PersonAddIcon />
              </IconButton>
            </Tooltip>
          )
        )
      }
    }

    return accounts.map(account => {
      if (client.account.id === account.id) { return }

      const extraProps = {} as { src?: string }
      if (account.avatarId) {
        extraProps.src = `avatars/${account.avatarId}` 
      }

      return (
        <ListItem key={ account.email } >
          <ListItemAvatar>
            <Avatar { ...extraProps }/>
          </ListItemAvatar>
          <ListItemText primary={ account.nickname } secondary = { account.email }/>
          {
            _generateFriendButton(account)
          }
          <ChatIcon />          
        </ListItem>
      )
    })
  }

  return (
    <div className={ classes.people }>
      <TextField
        className={ classes.searchBar }
        label="Search"
        onChange={ handleSearchOnChange }
        InputProps={ {
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon />
            </InputAdornment>
          ),
          className: classes.searchInput
        } }
      />
      <div className={ classes.accountList }>
        {
          generateAccountList(accounts)
        }
      </div>
    </div>
  )
}

export default People
