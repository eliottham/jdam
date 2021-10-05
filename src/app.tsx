import React, {
  useEffect, 
  useState 
} from 'react'

import JdamClient from 'client/jdam_client'
import { ThemeProvider } from '@material-ui/core'

import Workspace from './workspace/workspace'
import LoginDialog from 'login_dialog'

import { createTheme } from '@material-ui/core/styles'

const primaryColorHex = '#e37922'

export { primaryColorHex }

const theme = createTheme({
  palette: {
    primary: {
      main: primaryColorHex,
      contrastText: '#fff'
    }
  }
})

function App({ client }: { client: JdamClient }): JSX.Element {

  const [ loggedIn, setLoggedIn ] = useState(false)

  useEffect(() => {

    const onLogon = ({ success }: { errors: string[], success: boolean }) => {
      setLoggedIn(success)
    }

    const onLogoff = ({ loggedOff, expired }: { loggedOff: boolean, expired: boolean }) => {
      if (loggedOff || expired) {
        setLoggedIn(false)
      }
    }

    client.on('logon', onLogon)
    client.on('logoff', onLogoff)

    return () => {
      client.un('logon', onLogon)
      client.un('logoff', onLogoff)
    }
  }, [ client ])

  return (
    <div>
      <ThemeProvider theme={ theme }>
        <LoginDialog 
          open={ !loggedIn } 
          client={ client }
        />
        { loggedIn && <Workspace client={ client }/> }
      </ThemeProvider>
    </div>
  )
}

export default App
