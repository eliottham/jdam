import React from 'react'

import { 
  Button,
  ButtonProps
} from '@material-ui/core'

import { makeStyles } from '@material-ui/styles'

const useStyles = makeStyles({
  bigAction: {
    '&.MuiButton-root': {
      height: 300,
      width: 300,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      margin: '1em',
      '& .MuiButton-label > div': {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '1.0rem',
        '& .label': {
          marginTop: '2em'
        }
      },
      '& .MuiSvgIcon-root': {
        display: 'block',
        height: 48,
        width: 48
      }
    }
  }
})

export interface BigActionProps extends ButtonProps {
  label?: string | JSX.Element
}

function BigAction({ label, children, ...props} : BigActionProps): JSX.Element {

  const classes = useStyles()

  return (
    <Button className={ classes.bigAction + (props.className ? ' ' + props.className : '') } { ...props }>
      <div>
        { children }
        { typeof label === 'string' && <div className="label">{ label }</div> }
        { React.isValidElement(label) && label }
      </div>
    </Button>
  )
}

export default BigAction
