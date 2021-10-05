import Form, { 
  FormParams,
  TextFormField
} from './form'
import JdamClient from '../jdam_client'
import Validation from '../validation'


interface AccountCreateFormParams extends FormParams {
  client: JdamClient
}

class AccountCreateForm extends Form {

  client: JdamClient

  constructor(params: AccountCreateFormParams) {
    super(params)

    this.client = params.client

    const passwordField = new TextFormField({
      name: 'password'
    })
    const confirmPasswordField = new TextFormField({
      name: 'confirmPassword'
    })

    const validatePassword = () => {
      const password = passwordField.getValue()
      const confirmPassword = confirmPasswordField.getValue()
      const errors = Validation.validateNonEmpty(password)
        .concat(Validation.validatePassword(password))

      if (password !== confirmPassword ) {
        errors.push('Password and Confirm Password must match')
      }

      passwordField.fire('validate', { errors })
    }

    passwordField.on('set-value', () => {
      validatePassword() 
    })

    confirmPasswordField.on('set-value', () => {
      validatePassword() 
    })

    this.setFields([
      new TextFormField({
        name: 'email',
        validation: [ Validation.validateNonEmpty, Validation.validateEmail ],
        validationLatent: Validation.checkAccountAvailable
      }),
      passwordField,
      confirmPasswordField,
      new TextFormField({
        name: 'nickname',
        value: this.client.account.nickname,
        validation: [ Validation.validateNonEmpty, Validation.validateNickname ]
      })
    ])
  }

  async submit() {
    await this.client.createAccount({ 
      email: this.getField('email').getValue(),
      password: this.getField('password').getValue(),
      nickname: this.getField('nickname').getValue()
    })

    this.client.once('create-account', ({ errors }: { errors?: string[] }) => {
      if (errors?.length) {
        this.fire('errors', { errors })
      }
    })
  }

}

export default AccountCreateForm
