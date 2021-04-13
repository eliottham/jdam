class Validation {

  validatePassword(pass: string): string[] {
    const errors = []
    if (!pass) { return [] }
    pass = pass.trim() 
    if (!pass) { return [ 'password must not be blank' ] }
    if (pass.length < 12) { errors.push('password must be longer than 12 characters') }
    if (pass.length > 32) { errors.push('you have to be able to remember the password') }
    if (/^[A-Za-z0-9]+$/.test(pass)) { errors.push('password must contain special characters') }
    return errors
  }

  validateEmail(email: string): string[] {
    const errors = []
    if (!email) { return [] }
    email = email.trim() 
    if (!email) { return [ 'email must not be blank' ] }
    if (!/^\w[^@]+@[^.]+\.\w+/.test(email)) { errors.push('email is invalid') }
    return errors
  }

  validateNickname(nick: string): string[] {
    const errors = []
    if (nick.trim()) {
      if (nick.length > 25) { errors.push('nickname must be less than 25 characters') }
    }
    return errors
  }

  async checkAccountAvailable(email: string): Promise<{ success: boolean, errors?: string[] }> {
    try {
      const response = await fetch('account/available', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email })
      })
      const responseJson = await response.json()
      return responseJson
    } catch (err) {
      /* do nothing */
    }
    return { success: false }
  }

  validateSessionName(name: string): string[] {
    const errors = []
    if (/[^\w -]/g.test(name)) { errors.push( 'Session name can only contain alphanumeric characters, underscores, spaces, and dashes') }
    return errors
  }

}

export default Validation
