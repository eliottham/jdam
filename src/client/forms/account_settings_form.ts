import Form, { 
  FormParams,
  FormField,
  TextFormField
} from './form'
import JdamClient from '../jdam_client'
import Validation from '../validation'

export interface AvatarFormFieldParams {
  file?: File
  avatarId?: string
}

export class AvatarFormField extends FormField<AvatarFormFieldParams> {

  constructor(params: AvatarFormFieldParams) {
    super({ 
      name: 'avatar',
      value: { ...params }
    })
  }

  convertToString(): string {
    return ''
  }

  convertToValue(): AvatarFormFieldParams {
    return {}
  }

}

interface AccountSettingsFormParams extends FormParams {
  client: JdamClient
}

class AccountSettingsForm extends Form {

  client: JdamClient

  constructor(params: AccountSettingsFormParams) {
    super(params)

    this.client = params.client

    const passwordField = new TextFormField({
      name: 'newPassword'
    })
    const confirmPasswordField = new TextFormField({
      name: 'confirmNewPassword'
    })

    const validatePassword = () => {
      const password = passwordField.getValue()
      const confirmPassword = confirmPasswordField.getValue()
      const errors = Validation.validatePassword(password)

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
      new AvatarFormField({
        avatarId: this.client.account.avatarId
      }),
      new TextFormField({
        name: 'email',
        value: this.client.account.email,
        validation: Validation.validateEmail
      }),
      new TextFormField({
        name: 'nickname',
        value: this.client.account.nickname,
        validation: Validation.validateNickname
      }),
      new TextFormField({
        name: 'currentPassword'
      }),
      passwordField,
      confirmPasswordField
    ])
  }

  async submit() {
    /* TODO: update the account */
    const uploadAvatarValue = this.getField('avatar').getValue()
    if (uploadAvatarValue.file) {
      await this.client.uploadAvatar(uploadAvatarValue.file)
    }

    await this.client.updateAccountSettings({ 
      email: this.getField('email').getValue(),
      nickname: this.getField('nickname').getValue(),
      currentPassword: this.getField('currentPassword').getValue(),
      newPassword: this.getField('newPassword').getValue()
    })
  }

}

export default AccountSettingsForm
