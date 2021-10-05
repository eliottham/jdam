import Form, { 
  FormParams,
  FormField,
  TextFormField,
  NumberFormField
} from './form'
import JdamClient from '../jdam_client'
import Metro from '../metro'
import Validation from '../validation'

export interface MetronomeFormFieldParams {
  bpm?: number
  pattern?: number[]
  measures?: number
  metro: Metro
}

export class MetronomeFormField extends FormField<MetronomeFormFieldParams> {

  metro: Metro

  constructor(params: MetronomeFormFieldParams) {
    super({ 
      name: 'metronome_editor',
      value: { ...params }
    })

    this.metro = params.metro
  }

  convertToString(): string {
    return ''
  }

  convertToValue(): MetronomeFormFieldParams {
    return {
      bpm: 120,
      pattern: [ 2, 1, 1, 1 ],
      measures: 4,
      metro: this.metro
    }
  }

  setBpm(bpm: number) {
    const value = this.getValue()
    if (value) {
      this.setValue({
        bpm,
        ...value
      })
    }
  }

  setPattern(pattern: number[]) {
    const value = this.getValue()
    if (value) {
      this.setValue({
        pattern,
        ...value
      })
    }
  }

  setMeasures(measures: number) {
    const value = this.getValue()
    if (value) {
      this.setValue({
        measures,
        ...value
      })
    }
  }

}

interface SessionCreateFormParams extends FormParams {
  client: JdamClient
}

class SessionCreateForm extends Form {

  client: JdamClient

  constructor(params: SessionCreateFormParams) {
    super(params)

    this.client = params.client

    this.setFields([
      new TextFormField({
        name: 'title',
        validation: [ Validation.validateNonEmpty, Validation.validateSessionName ]
      }),
      new TextFormField({
        name: 'description',
        validation: [ Validation.validateNonEmpty, Validation.validateSafeText ]
      }),
      new NumberFormField({
        name: 'length',
        value: 60,
        validation: (input?: number): string[] => {
          if (Number(input) > 120) {
            return [ 'Session cannot be longer than 2 hours' ]
          } else {
            return []
          }
        }
      }),
      new MetronomeFormField({
        metro: this.client.metro
      })
    ])
  }

  async submit() {
    const metroValue = this.getField('metronomeEditor').getValue()
    if (this.valid) {
      this.client.createSession({
        title: this.getField('title').getValue(),
        description: this.getField('description').getValue(),
        sessionLength: this.getField('length').getValue(),
        bpm: metroValue.bpm,
        measures: metroValue.measures,
        pattern: metroValue.pattern
      })

      this.client.once('create-session', ({ errors }: { errors?: string[] }) => {
        if (errors?.length) {
          this.fire('errors', { errors })
        }
      })
    }
  }

}

export default SessionCreateForm
