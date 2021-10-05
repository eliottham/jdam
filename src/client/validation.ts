import Evt from '../client/evt'

export type LatentStatus = 'pending' | 'complete'
export type ValidationFunction<ValueType> = (input?: ValueType) => string[]

export interface LatentValidation<ValueType=string> {
  validate: (value?: ValueType) => Promise<string[]>
  pending: boolean
}

class CheckAccountAvailable extends Evt implements LatentValidation {
  pending = false

  async validate(email?: string): Promise<string[]> {
    this.fire('pending', { status: 'pending' })
    if (!this.pending) {
      this.pending = true
      try {
        const response = await fetch('/account/available', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ email })
        })
        const responseJson = await response.json()
        this.pending = false
        this.fire('pending', { status: 'complete' })
        this.fire('validate', responseJson)
        return responseJson.errors || new Array<string>()
      } catch (err) {
        /* do nothing */
      }
      this.pending = false
      this.fire('pending', { status: 'complete' })
      this.fire('validate', { success: false })
      return [ 'Unable to check account availability' ]
    }
    return []
  }
}

const checkAccountAvailable = new CheckAccountAvailable()

const Validation = {

  validateNonEmpty(input?: string): string[] {
    if (!input) {
      return [ 'Field must not be empty' ]
    }
    return []
  },

  validateNonBlank(input?: string): string[] {
    if (!input) {
      return []
    }
    if (!input.trim()) {
      return [ 'Field must not be blank' ]
    }
    return []
  },

  validatePassword(pass?: string): string[] {
    const errors = []
    if (!pass) { return [] }
    pass = pass.trim() 
    if (!pass) { return [ 'Password must not be blank' ] }
    if (pass.length < 12) { errors.push('Password must be longer than 12 characters') }
    if (pass.length > 32) { errors.push('You have to be able to remember the password') }
    if (/^[A-Za-z0-9]+$/.test(pass)) { errors.push('password must contain special characters') }
    return errors
  },

  validateEmail(email?: string): string[] {
    const errors = []
    if (!email) { return [] }
    email = email.trim() 
    if (!email) { return [ 'Email must not be blank' ] }
    if (!/^\w[^@]+@[^.]+\.\w+/.test(email)) { errors.push('email is invalid') }
    return errors
  },

  validateNickname(nick?: string): string[] {
    const errors = []
    if (nick && nick.trim()) {
      if (nick.length > 25) { errors.push('Nickname must be less than 25 characters') }
    }
    return errors
  },

  checkAccountAvailable(email?: string): Promise<string[]> {
    return new Promise<string[]>(resolve => {
      const errors: string[] = []
      if (!email) {
        resolve([]) 
        return
      }

      checkAccountAvailable.validate(email) /* this will noop with pending is true */

      /* 
       * alway add a once-off listener, which allows for any late-entering
       * listeners to update, without having to re-submit validation all over
       * again
       */
      checkAccountAvailable.once('validate', (responseJson: { success: boolean, errors?: string[] }) => {
        const { success } = responseJson 
        if (!success) { errors.push('Account is already in use') }
        resolve(errors)
      })
    })
  },

  validateSessionName(name?: string): string[] {
    const errors = []
    if (!name) { return [] }
    if (name && name.length < 8) { errors.push('Session name must be 8 characters or longer') }
    if (Validation.validateSafeText(name).length) { errors.push( 'Session name can only contain alphanumeric characters, underscores, spaces, and dashes') }
    return errors
  },

  validateSafeText(text?: string): string[] {
    const errors = []
    if (!text) { return [] }
    if (/[^\w -]/g.test(text)) { errors.push( 'Text can only contain alphanumeric characters, underscores, spaces, and dashes') }
    return errors
  },

  validateNumeric(input?: string): string[] {
    const errors = []
    if (!input) { return [] }
    if (isNaN(Number(input))) { errors.push( 'Input must be a number' ) }
    return errors
  }

}

export default Validation
