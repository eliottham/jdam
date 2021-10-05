import React from 'react'

import { CSSTransition } from 'react-transition-group'

import { makeStyles } from '@material-ui/styles'
import {
  useRef, RefObject 
} from 'react'
import { Card } from '@material-ui/core'

const useStyles = makeStyles({
  authError: {
    fontSize: '1.1rem',
    color: 'var(--red)'
  },
  errors: {
    '&.MuiCard-root': {
      padding: '1em',
      margin: '0 1em',
      color: 'white',
      backgroundColor: 'var(--red)',
      borderRadius: 4,
      transition: 'all 500ms var(--ease-out)',
      overflow: 'hidden',
      boxSizing: 'content-box',
      '& $authError': {
        color: 'white'
      }
    },
    '&.enter': {
      padding: '0 1em'
    },
    '&.enter-active, &.exit': {
      padding: '1em'
    },
    '&.exit-active': {
      padding: '0 1em'
    }
  }
})

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

interface PopupErrorsProps {
  errors?: string[]
  showErrors?: boolean
}

function PopupErrors(props: PopupErrorsProps): JSX.Element {
  
  const classes = useStyles()
  
  const errorsRef = useRef<HTMLDivElement>(null)

  return (
    <CSSTransition
      in={ !!props.showErrors }
      nodeRef={ errorsRef }
      timeout={ 500 }
      unmountOnExit={ true }
      onEnter={ ()=>heightZero(errorsRef) }
      onEntering={ ()=>heightToContent(errorsRef) }
      onEntered={ ()=>heightUnset(errorsRef) }
      onExit={ ()=>heightToContent(errorsRef) }
      onExiting={ ()=>heightZero(errorsRef) }
    >
      <Card className={ classes.errors } ref={ errorsRef }>
        <div>
          { 
            props.errors?.map((err, index) => {
              return <div key={ `auth-err-${index}` } className={ classes.authError }>{ err }</div>
            })
          }
        </div>
      </Card>
    </CSSTransition>
  )
}

export default PopupErrors
