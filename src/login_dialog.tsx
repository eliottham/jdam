import React, {
  useEffect, 
  useState 
} from 'react'

import JdamClient from 'client/jdam_client'
import { 
  Dialog,
  Tabs,
  Tab,
  Button
} from '@material-ui/core'
import {
  FormDisplay,
  Icon,
  PopupErrors
} from 'comps/comps'

import {
  ConfirmTextFormFieldDisplay,
  TextFormFieldDisplay 
} from 'comps/form_field'

import { makeStyles } from '@material-ui/styles'
import LoginForm from 'client/forms/login_form'
import AccountCreateForm from 'client/forms/account_create_form'

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


interface LoginDialogProps { 
  open: boolean
  tabIndex?: number
  client: JdamClient
}

/* Login / Account creation dialog */
function LoginDialog( { open, client, tabIndex: tabInd }: LoginDialogProps): JSX.Element {

  const classes = useStyles()

  const [ tabIndex, setTabIndex ] = useState(tabInd ?? 0)
  const [ errors, setErrors ] = useState<string[]>([])
  const [ showErrors, setShowErrors ] = useState(false)
  const [ loginForm ] = useState(new LoginForm({ client } ))
  const [ accountCreateForm ] = useState(new AccountCreateForm({ client } ))
  const [ formValid, setFormValid ] = useState(loginForm.getValid())

  useEffect(() => {

    let timerInd = -1

    const onErrors = (errors: string[]) => {
      setErrors(errors)
      setShowErrors(!!errors.length)
      if (!errors.length) {
        window.clearTimeout(timerInd)
      } else {
        timerInd = window.setTimeout(() => {
          setShowErrors(false)
        }, 5000)
      }
    }

    const onCreateAccount = ({ errors = [] }: { errors: string[] }) => {
      if (!errors.length) {
        loginForm.clearFields()
        setTabIndex(0)
      } 
      onErrors(errors)
    }

    const onLogon = ({ errors = [] }: { errors: string[] }) => {
      if (!errors.length) {
        loginForm.clearFields()
      }
      onErrors(errors)
    }

    const onLogoff = ({ loggedOff, expired }: { loggedOff: boolean, expired: boolean }) => {
      if (loggedOff || expired) {
        const errors:string[] = []
        if (loggedOff) { errors.push('Logged off') }
        if (expired) { errors.push('Session expired') }
        onErrors(errors)
      }
    }

    const onValidate = ({ errors }: { errors: string[] }) => {
      setFormValid(!errors.length)
    }

    client.on('logon', onLogon)
    client.on('logoff', onLogoff)
    client.on('create-account', onCreateAccount)
    loginForm.on('validate', onValidate)
    accountCreateForm.on('validate', onValidate)

    return () => {
      client.un('logon', onLogon)
      client.un('logoff', onLogoff)
      client.un('create-account', onCreateAccount)
      loginForm.un('validate', onValidate)
      accountCreateForm.un('validate', onValidate)
    }
  }, [ client, loginForm, accountCreateForm ])

  const handleSubmit = () => {
    loginForm.submit()
  }
  
  const handleTabChange = (event: React.SyntheticEvent, newValue: string) => {
    setTabIndex(Number(newValue))
    setFormValid(false)
  }

  const loginFields = (): React.ReactFragment => {
    return <>
      <TextFormFieldDisplay
        fragment
        hideErrors
        label="Email"
        model={ loginForm.getField('email') }
      />
      <TextFormFieldDisplay
        fragment
        hideErrors
        label="Password"
        model={ loginForm.getField('password') }
        type="password"
      />
    </>
  }

  const createAccountFields = (): React.ReactFragment => {
    return <>
      <TextFormFieldDisplay
        fragment
        label="Email"
        model={ accountCreateForm.getField('email') }
      />
      <ConfirmTextFormFieldDisplay
        fragment
        label="Password"
        hint="Confirm Password"
        model={ accountCreateForm.getField('password') }
        confirmModel={ accountCreateForm.getField('confirmPassword') }
        type="password"
      />
      <TextFormFieldDisplay
        fragment
        label="Nickname"
        model={ accountCreateForm.getField('nickname') }
      />
    </>
  }

  return (
    <Dialog
      className={ classes.loginDialog }
      open={ open }
    >
      <div className="splash flex-center" style={ { flexDirection: 'column', color: 'white' } }>
        <div style={ { fontSize: '2rem', marginBottom: '24px' } }>JDAM</div>
        <Icon url="/assets/icons_proc/jdam.svg#jdam" className="white"/>
        <div style={ { fontSize: '1.2rem', marginTop: '24px' } }>EXPLOSIVE JAMS!</div>
      </div>
      <div className="content-wrapper">
        <Tabs value={ tabIndex } onChange={ handleTabChange } centered>
          <Tab label="Login" />
          <Tab label="Sign-up" />
        </Tabs>
        <div className={ classes.formWrapper }>
          <FormDisplay
            noSubmit={ true }
            hideErrors={ true }
            model={ !tabIndex ? loginForm : accountCreateForm }
          >
            {
              !tabIndex ? loginFields() : createAccountFields()
            }
          </FormDisplay>
        </div>
        <PopupErrors
          errors={ errors }
          showErrors={ showErrors }
        />
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

export default LoginDialog
