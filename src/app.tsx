import JdamClient from './client/jdam_client'
import { useEffect, useState } from 'react'
import { 
  Dialog,
  Tabs,
  Tab,
  Button,
  ThemeProvider
} from '@material-ui/core'
import { Form, Icon, PopupErrors } from './comps/comps'
import { FormFieldTemplate } from './comps/form_field'
import Workspace from './workspace/workspace'

import { createTheme } from '@material-ui/core/styles'
import { makeStyles } from '@material-ui/styles'
import Validation from './client/validation'

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

const useStyles = makeStyles({
  loginDialog: {
    '& > .MuiDialog-container > .MuiPaper-root': {
      maxWidth: '100%',
      minWidth: 500,
      height: 500,
      flexDirection: 'row',
      '& .splash': {
        width: 400,
        height: '100%',
        backgroundImage: [ 
          'linear-gradient(160deg, var(--lt-yellow), transparent)',
          'radial-gradient(ellipse 150% 150% at 0% 100%, var(--primary), transparent)',
          'radial-gradient(ellipse 150% 150% at 100% 100%, var(--red), transparent)' 
        ].join(', ')
      }
    },
    '& .content-wrapper': {
      display: 'flex',
      flexDirection: 'column',
      height: '100%'
    }
  },
  formWrapper: {
    padding: '1em',
    flex: 1,
    width: 540,
    display: 'flex',
    alignItems: 'center'
  },
  launchButton: {
    '&.MuiButton-root': {
      margin: '1em'
    }
  }
})

/* Login / Account creation dialog */
interface LoginDialogProps { 
  open: boolean
  errors: string[]
  showErrors?: boolean
  tabIndex?: number
  client: JdamClient
  onSubmit: (params: { email: string, password: string, nickname?: string, newAccount: boolean }) => void 
}

const createAccountFieldTemplates: Array<FormFieldTemplate> = [ 
  {
    name: 'email',
    label: 'email',
    validation: Validation.validateEmail,
    latentValidation: Validation.checkAccountAvailable
  }, {
    name: 'password',
    label: 'password',
    type: 'password',
    confirm: true,
    validation: Validation.validatePassword
  }, {
    name: 'nickname',
    label: 'nickname',
    validation: Validation.validateNickname
  } ]
  
const loginFieldTemplates = createAccountFieldTemplates.slice(0, 2).map(temp => {
  const newTemp = { ...temp }
  delete newTemp.confirm
  delete newTemp.validation
  return newTemp
}) 

function LoginDialog( { open, onSubmit, client, tabIndex: tabInd, errors, showErrors }: LoginDialogProps): JSX.Element {

  const classes = useStyles()

  const [ tabIndex, setTabIndex ] = useState(tabInd ?? 0)
  /* keep track of field values for submission */
  const [ formFields, setFormFields ] = useState<{ [index: string]: string }>({ email: '', password: '', nickname: '' })

  /* keep track of field validity separately 
   *
   * this is useful for latent
   * validation that queries the server for additional information
   * 
   * this is also useful for confirmation fields which don't update the
   * value directly, but only update the validity based on matching
   */
  const [ formValid, setFormValid ] = useState(true)

  /* clear all fields except email, which is save to keep around */
  const resetFields = () => {
    setFormFields({ ...formFields, password: '', nickname: '' })
  }

  useEffect(() => {
    const onCreateAccount = ({ errors = [] }: { errors: string[] }) => {
      if (!errors.length) {
        tabChange(0)
      }
    }

    const onLogon = ({ success }: { success: boolean }) => {
      if (success) {
        resetFields()
      }
    }

    client.on('logon', onLogon)
    client.on('create-account', onCreateAccount)

    return () => {
      client.un('logon', onLogon)
      client.un('create-account', onCreateAccount)
    }
  }, [ client ])

  const tabChange = (index: number) => {
    /* reset fields when switching back to the LOGIN tab */
    resetFields()

    setTabIndex(index)
    setFormValid(index === 0)
  }

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    tabChange(newValue)
  }

  const handleSubmit = () => {
    onSubmit({
      email: formFields['email'],
      password: formFields['password'],
      nickname: formFields['nickname'],
      newAccount: tabIndex === 1
    })
  }

  return (
    <Dialog
      className={ classes.loginDialog }
      open={ open }
    >
      <div className="splash flex-center" style={ { flexDirection: "column", color: "white" } }>
        <div style={ { fontSize: "2rem", marginBottom: "24px" } }>JDAM</div>
        <Icon url="/assets/icons_proc/jdam.svg#jdam" className="white"/>
        <div style={ { fontSize: "1.2rem", marginTop: "24px" } }>EXPLOSIVE JAMS!</div>
      </div>
      <div className="content-wrapper">
        <Tabs value={ tabIndex } onChange={ handleTabChange } centered>
          <Tab label="Login" />
          <Tab label="Sign-up" />
        </Tabs>
        <div className={ classes.formWrapper }>
          <Form
            fieldTemplates={ tabIndex === 0 ? loginFieldTemplates : createAccountFieldTemplates }
            noSubmit={ true }
            formValid={ formValid }
            setFormValid={ setFormValid }
            formFields={ formFields }
            setFormFields={ setFormFields }
            onSubmit={ handleSubmit }
          />
        </div>
        <div style={ { margin: '0 1em' } }>
          <PopupErrors
            errors={ errors }
            showErrors={ showErrors }
          />
        </div>
        <Button 
          onClick={ handleSubmit } 
          variant="contained" 
          disabled={ !formValid }
          className={ classes.launchButton }
        >
          { tabIndex === 0 ? 'Launch' : 'Create' }
        </Button>
      </div>
    </Dialog>
  )

}

function App(props: {client: JdamClient}): JSX.Element {

  const [ loggedIn, setLoggedIn ] = useState(false)
  const [ authErrors, setAuthErrors ] = useState<string[]>([])
  const [ showErrors, setShowErrors ] = useState(false)
  const [ timeoutIndex, setTimeoutIndex ] = useState(-1)

  useEffect(() => {
    const onErrors = ({ errors = [] }: { errors: string[] }) => {
      setAuthErrors(errors)
      setShowErrors(!!errors.length)
      if (errors.length) {
        if (timeoutIndex >= 0) { window.clearTimeout(timeoutIndex) }
        setTimeoutIndex(window.setTimeout(() => {
          setShowErrors(false)
        }, 5000))
      }
    }

    const onLogon = ({ errors = [], success }: { errors: string[], success: boolean }) => {
      setLoggedIn(success)
      onErrors({ errors })
    }

    const onLogoff = ({ loggedOff, expired }: { loggedOff: boolean, expired: boolean }) => {
      if (loggedOff || expired) {
        setLoggedIn(false)
        const errors:string[] = []
        if (loggedOff) { errors.push('Logged off') }
        if (expired) { errors.push('Session expired') }
        onErrors({ errors })
      }
    }

    props.client.on('logon', onLogon)
    props.client.on('logoff', onLogoff)
    props.client.on('create-account', onErrors)

    return () => {
      props.client.un('logon', onLogon)
      props.client.un('logoff', onLogoff)
      props.client.un('create-account', onErrors)
      window.clearTimeout(timeoutIndex)
    }
  }, [ props.client, timeoutIndex ])

  const handleOnSubmit = ({ email, password, nickname = '', newAccount = false }: { email: string, password: string, nickname?: string, newAccount: boolean }) => {
    if (newAccount) {
      props.client.createAccount({ email, password, nickname })
    } else {
      props.client.logon(email, password)
    }
  }

  return (
    <div>
      <ThemeProvider theme={ theme }>
        <LoginDialog 
          open={ !loggedIn } 
          onSubmit={ handleOnSubmit } 
          errors={ authErrors } 
          showErrors={ showErrors } 
          client={ props.client }
        />
        { loggedIn && <Workspace client={ props.client }/> }
      </ThemeProvider>
    </div>
  )
}

export default App
