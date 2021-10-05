import Form, { 
  FormParams,
  TextFormField
} from './form'
import JdamClient from '../jdam_client'
import Validation from 'client/validation'

interface LoginFormParams extends FormParams {
  client: JdamClient
}

class LoginForm extends Form {

  client: JdamClient

  constructor(params: LoginFormParams) {
    super(params)

    this.client = params.client

    this.setFields([
      new TextFormField({
        name: 'email',
        value: this.client.account.email,
        validation: [ Validation.validateNonEmpty, Validation.validateNonBlank ]
      }),
      new TextFormField({
        name: 'password',
        value: this.client.account.nickname,
        validation: [ Validation.validateNonEmpty, Validation.validateNonBlank ]
      })
    ])
  }

  async submit() {
    this.client.logon(
      this.getField('email').getValue(),
      this.getField('password').getValue()
    )

    this.client.once('logon', ({ errors }: { errors?: string[] }) => {
      if (errors?.length) {
        this.fire('errors', { errors })
      }
    })
  }

}

export default LoginForm
