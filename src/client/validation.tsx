import Evt from '../client/evt'

export interface LatentValidation {
  validate: (input: string) => Promise<void>
  pending: boolean
}

class CheckAccountAvailable extends Evt implements LatentValidation {
  pending = false

  async validate(email: string) {
    if (!this.pending) {
      this.pending = true
      try {
        const response = await fetch('account/available', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ email })
        })
        const responseJson = await response.json()
        this.pending = false
        this.fire('validate', responseJson)
        return 
      } catch (err) {
        /* do nothing */
      }
      this.pending = false
      this.fire('validate', { success: false })
    }
  }
}

const checkAccountAvailable = new CheckAccountAvailable()

const Validation = {

  validatePassword(pass: string): string[] {
    const errors = []
    if (!pass) { return [] }
    pass = pass.trim() 
    if (!pass) { return [ 'password must not be blank' ] }
    if (pass.length < 12) { errors.push('password must be longer than 12 characters') }
    if (pass.length > 32) { errors.push('you have to be able to remember the password') }
    if (/^[A-Za-z0-9]+$/.test(pass)) { errors.push('password must contain special characters') }
    return errors
  },

  validateEmail(email: string): string[] {
    const errors = []
    if (!email) { return [] }
    email = email.trim() 
    if (!email) { return [ 'email must not be blank' ] }
    if (!/^\w[^@]+@[^.]+\.\w+/.test(email)) { errors.push('email is invalid') }
    return errors
  },

  validateNickname(nick: string): string[] {
    const errors = []
    if (nick.trim()) {
      if (nick.length > 25) { errors.push('nickname must be less than 25 characters') }
    }
    return errors
  },

  checkAccountAvailable(email: string): Promise<string[]> {
    return new Promise(resolve => {
      const errors: string[] = []
      checkAccountAvailable.validate(email) /* this will noop with pending is true */

      /* 
       * alway add a once-off listener, which allows for any late-entering
       * listeners to update, without having to re-submit validation all over
       * again
       */
      checkAccountAvailable.once('validate', (responseJson: { success: boolean, errors?: string[] }) => {
        const { success } = responseJson 
        if (!success) { errors.push('account is already in use') }
        resolve(errors)
      })
    })
  },

  validateSessionName(name: string): string[] {
    const errors = []
    if (name && name.length < 8) { errors.push('Session name must be 8 characters or longer') }
    if (Validation.validateSafeText(name).length) { errors.push( 'Session name can only contain alphanumeric characters, underscores, spaces, and dashes') }
    return errors
  },

  validateSafeText(text: string): string[] {
    const errors = []
    if (/[^\w -]/g.test(text)) { errors.push( 'Text can only contain alphanumeric characters, underscores, spaces, and dashes') }
    return errors
  },

  validateNumeric(input: string): string[] {
    const errors = []
    if (isNaN(Number(input))) { errors.push( 'Input must be a number' ) }
    return errors
  }

}

export default Validation
