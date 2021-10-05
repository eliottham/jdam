import Evt from '../evt'
import { ThisIsCheating } from '../types'
import { ValidationFunction } from '../validation'

export interface FormFieldTemplate<ValueType> {
    name: string
    confirm?: boolean
    validation?: ValidationFunction<ValueType> | Array<ValidationFunction<ValueType>>
    validationLatent?: (input?: ValueType) => Promise<string[]>
    value?: ValueType
}

abstract class FormField<ValueType> extends Evt {

  name: string
  valid = false
  confirm?: boolean
  validation?: ValidationFunction<ValueType> | Array<ValidationFunction<ValueType>>
  validationLatent?: (input?: ValueType) => Promise<string[]>
  pendingValidation = false
  
  private value?: ValueType
  private errors = new Array<string>()

  private debounceInd = -1

  constructor(params:FormFieldTemplate<ValueType>) {
    super()
    this.name = params.name

    Object.assign(this, params)
  }

  clearValidationErrors() {
    this.errors = []
  }

  getValidationErrors() {
    return this.errors.slice()
  }

  validate(input?: ValueType): string[] {
    const errors = new Array<string>()
    this.valid = true

    if (this.validation) {
      if (!Array.isArray(this.validation)) {
        Array.prototype.push.apply(errors, this.validation(input))
      } else {
        for (const validation of this.validation) {
          Array.prototype.push.apply(errors, validation(input))
        }
      }
    }

    this.valid = !errors.length
    this.errors = errors.slice()
    return errors
  }

  async validateLatent(input?: ValueType): Promise<string[]> {
    this.fire('pending', { status: 'pending' })
    const errors = this.validate(input)

    if (!errors.length && this.validationLatent) {
      const latentErrors = await this.validationLatent(input)
      Array.prototype.push.apply(errors, latentErrors)
    }

    this.fire('pending', { status: 'complete' })
    this.valid = !errors.length
    this.errors = errors.slice()
    return errors
  }

  abstract convertToString(input: ValueType): string

  abstract convertToValue(input: string): ValueType

  clear() {
    this.clearValidationErrors()
    this.setValue(undefined)
  }

  async setValue(input?: ValueType) {
    this.value = input
    this.fire('set-value', { value: input })

    /* validateLatent also performs regular valiation */
    if (this.validation) {
      this.fire('validate', { errors: this.validate(input) })
    }

    if (this.validationLatent) {
      window.clearTimeout(this.debounceInd)
      this.debounceInd = window.setTimeout(async () => {
        this.fire('validate', { errors: await this.validateLatent(input) })
      }, 400)
    }
  }
  
  getValue() {
    return this.value
  }
}

export { FormField }

class TextFormField extends FormField<string> {

  convertToString(input: string): string {
    return input
  }

  convertToValue(input: string): string {
    return input
  }

  async setValue(input?: string) {
    /* 
     * force a blank string to be passed, so that react fields
     * will not become uncontrolled
     */
    super.setValue(input || '')
  }

  getValue() {
    /* 
     * force a blank string to be returned, so that react fields
     * will not become uncontrolled
     */
    return super.getValue() || ''
  }
}

class NumberFormField extends FormField<number> {

  convertToString(input: number): string {
    return '' + input
  }

  convertToValue(input: string): number {
    return Number(input)
  }

}

export {
  TextFormField, 
  NumberFormField
}

export interface FormParams {
  fields?: FormField<ThisIsCheating>[]
  onSubmit?: (fields: FormField<ThisIsCheating>[]) => void
  valid?: boolean
}

class Form extends Evt {

  private fieldsInternal = new Array<FormField<ThisIsCheating>>()
  onSubmit?: (fields: FormField<ThisIsCheating>[]) => void

  protected valid = false

  private registeredListener: () => void
  
  constructor(params:FormParams) {
    super()

    if (params.fields) {
      this.fieldsInternal = params.fields
    }

    this.onSubmit = params.onSubmit
    this.registeredListener = () => {
      let valid = true
      const errors = new Array<string>()
      for (const field of this.fieldsInternal) {
        if (!field.valid) {
          valid = false
          Array.prototype.push.apply(errors, field.getValidationErrors())
        }
      }
      this.valid = valid
      this.fire('validate', { errors })
    }

    Object.assign(this, params)
  }

  getValid() {
    return this.valid
  }

  clearFields() {
    for (const field of this.fieldsInternal) {
      field.clear()
    }
  }
  
  setFields(fields: FormField<ThisIsCheating>[]) {
    /* remove all listeners for valid first */
    if (this.registeredListener) {
      for (let a = 0; a < this.fieldsInternal.length; a++) {
        const field = this.fieldsInternal[a]
        field.un('validate', this.registeredListener)
      }
    }

    this.fieldsInternal = new Array<FormField<ThisIsCheating>>()

    for (const field of fields) {
      this.fieldsInternal.push(field)
      field.on('validate', this.registeredListener)
    }
  }

  getFields() {
    return this.fieldsInternal
  }

  getField(name: string, index = 0): FormField<ThisIsCheating> {
    const result = this.fieldsInternal.find(field => field.name === name)
    if (result) {
      return result
    } else {
      return this.fieldsInternal[index]
    }
  }

  async submit() {
    const fields = this.fieldsInternal.slice()
    this.onSubmit?.(fields)
    this.fire('submit', { fields })
  }


}

export default Form
