import './app.css'
import JdamClient from './client/jdam_client'
import { useEffect, useState, useRef, RefObject } from 'react'
import { 
  Dialog,
  DialogActions,
  DialogContent,
  Tabs,
  Tab,
  Button,
  Card
} from '@material-ui/core'
import { CSSTransition } from 'react-transition-group'
import { FormField, Icon } from './comps/comps'
import Workspace from './workspace/workspace'

/* Login / Account creation dialog */
function LoginDailog( props: { 
  open: boolean,
  errors: string[],
  showErrors?: boolean,
  tabIndex?: number,
  client: JdamClient,
  onSubmit: (params: { email: string, password: string, nickname?: string, newAccount: boolean }) => void }): JSX.Element {

  const [ tabIndex, setTabIndex ] = useState(props.tabIndex ?? 0)
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
  const [ formFieldsValid, setFormFieldsValid ] = useState<{ [index: string]: boolean }>({ email: false, password: false, nickname: true })
  const [ formValid, setFormValid ] = useState(true)

  /* clear all fields except email, which is save to keep around */
  const resetFields = () => {
    setFormFields({ ...formFields, password: '', nickname: '' })
    setFormFieldsValid({ ...formFieldsValid, email: false, password: false, nickname: true})
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

    props.client.on('logon', onLogon)
    props.client.on('create-account', onCreateAccount)

    return () => {
      props.client.un('logon', onLogon)
      props.client.un('create-account', onCreateAccount)
    }
  }, [ props.client ])

  const errorsRef = useRef<HTMLDivElement>(null)

  const validatePassword = (pass: string): string[] => {
    const errors = []
    if (!pass) { return [] }
    pass = pass.trim() 
    if (!pass) { return [ 'password must not be blank' ] }
    if (pass.length < 12) { errors.push('password must be longer than 12 characters') }
    if (pass.length > 32) { errors.push('you have to be able to remember the password') }
    if (/^[A-Za-z0-9]+$/.test(pass)) { errors.push('password must contain special characters') }
    return errors
  }

  interface FieldTemplate {
    name: string,
    label?: string,
    type?: string,
    confirm?: boolean,
    validation: (input: string) => string[],
    latentValidation?: (input: string) => Promise<string[]>
  }

  const fieldTemplates: Array<FieldTemplate> = [ 
    {
      name: 'email',
      label: 'email',
      validation: (email: string): string[] => {
        const errors = []
        if (!email) { return [] }
        email = email.trim() 
        if (!email) { return [ 'email must not be blank' ] }
        if (!/^\w[^@]+@[^.]+\.\w+/.test(email)) { errors.push('email is invalid') }
        return errors
      },
      latentValidation: async (email: string): Promise<string[]> => {
        const errors = []
        const { success } = await props.client.checkAccountAvailable(email)
        if (!success) { errors.push('account is already in use') }
        return errors
      }
    }, {
      name: 'password',
      label: 'password',
      type: 'password',
      confirm: true,
      validation: validatePassword 
    }, {
      name: 'nickname',
      label: 'nickname',
      validation: (nick: string): string[] => {
        const errors = []
        if (nick.trim()) {
          if (nick.length > 25) { errors.push('nickname must be less than 25 characters') }
        }
        return errors
      }
    } ]
    

  const tabChange = (index: number) => {
    setTabIndex(index)
    setFormValid(index === 0)

    /* reset fields when switching back to the LOGIN tab */
    index === 0 && resetFields()
  }

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    tabChange(newValue)
  }

  const handleSubmit = () => {
    props.onSubmit({
      email: formFields.email,
      password: formFields.password,
      nickname: formFields.nickname,
      newAccount: tabIndex === 1
    })
  }

  /* create a form field and setup all it's handlers */
  const _field = (template: FieldTemplate, validation: boolean, last: boolean): JSX.Element => {
    const handleFieldChange = (input: string) => {
      const newFields = { ...formFields }
      newFields[template.name] = input
      setFormFields(newFields)
    }
    const handleEnter = (input: string, isConfirm: boolean) => {
      last && handleSubmit()
    }
    const handleFieldValidate = (valid: boolean) => {
      const newValidFields = { ...formFieldsValid }
      if (validation) {
        newValidFields[template.name] = valid
        setFormFieldsValid(newValidFields)
      }
      let formValid = true
      if (tabIndex === 1) {
        for (const fieldName in newValidFields) {
          formValid = formValid && newValidFields[fieldName]
        }
      }
      setFormValid(formValid)
    }
    return <FormField 
      validate={ validation } 
      key={ `field-${validation ? 'v-' : ''}${template.name}` } 
      value={ formFields[template.name] }
      fragment={ true } 
      onChange={ handleFieldChange } 
      onEnter={ handleEnter }
      onValidate={ handleFieldValidate }
      { ...template } 
      confirm={ template.confirm && validation }
    />
  }

  const loginFields = () => {
    return (
      <>
        {
          fieldTemplates.slice(0, 2).map((template, index, arr) => {
            return _field(template, false, index === arr.length - 1)
          })
        }
      </>
    )
  }

  const accountCreateFields = () => {
    return (
      <>
        {
          fieldTemplates.map((template, index, arr) => {
            return _field(template, true, index === arr.length - 1)
          })
        }
      </>
    )
  }

  /* CSSTransition updates */
  const heightZero = (ref: RefObject<HTMLDivElement>) => {
    if (!ref.current) return
    ref.current.style.height = '0'
  }
  const heightToContent = (ref: RefObject<HTMLDivElement>) => {
    if (!ref.current) return
    ref.current.style.height = `${(ref.current.children[0] as HTMLDivElement).offsetHeight}px`
  }
  const heightUnset = (ref: RefObject<HTMLDivElement>) => {
    if (!ref.current) return
    ref.current.style.height = ''
  }

  return (
    <Dialog
      className="login-dialog"
      open={ props.open }
    >
      <div className="splash flex-center" style={{ flexDirection: "column", color: "white" }}>
        <div style={{ fontSize: "2rem", marginBottom: "24px" }}>JDAM</div>
        <Icon url="assets/icons_proc/jdam.svg#jdam" className="white"/>
        <div style={{ fontSize: "1.2rem", marginTop: "24px" }}>It&apos;s the bomb</div>
      </div>
      <div className="content-wrapper">
        <Tabs value={ tabIndex } onChange={ handleTabChange } centered>
          <Tab label="Login" />
          <Tab label="Sign-up" />
        </Tabs>
        <DialogContent className="grid-wrapper">
          <div className="grid">
            { tabIndex === 0 ? loginFields() : accountCreateFields() } 
          </div>
        </DialogContent>
        <CSSTransition
          in={ !!props.showErrors }
          nodeRef={ errorsRef }
          timeout={ 500 }
          unmountOnExit={ true }
          onEnter={()=>heightZero(errorsRef)}
          onEntering={()=>heightToContent(errorsRef)}
          onEntered={()=>heightUnset(errorsRef)}
          onExit={()=>heightToContent(errorsRef)}
          onExiting={()=>heightZero(errorsRef)}
        >
          <Card className="errors" ref={ errorsRef }>
            <div>
              { 
                props.errors.map((err, index) => {
                  return <div key={ `auth-err-${index}` } className="auth-error">{ err }</div>
                })
              }
            </div>
          </Card>
        </CSSTransition>
        <Button 
          onClick={ handleSubmit } 
          variant="contained" 
          disabled={ !formValid }
          className="jd-button launch-button">{ tabIndex === 0 ? 'Launch' : 'Create' }
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
      <LoginDailog open={ !loggedIn } onSubmit={ handleOnSubmit } errors={ authErrors } showErrors={ showErrors } client={ props.client }/>
      { loggedIn && <Workspace client={ props.client }/> }
    </div>
  )
}

export default App
