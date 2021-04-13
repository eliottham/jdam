import { makeStyles } from '@material-ui/styles'
import SlidingPageDialog from './sliding_page_dialog'
import BigAction, { BigActionProps } from './big_action'
import FormField, { FormFieldTemplate } from './form_field'

const useStyles = makeStyles({
  icon: {
    '--icon-size': 128,
    '--icon-col': 'var(--primary)',
    width: 'var(--icon-size)',
    height: 'var(--icon-size)',
    boxSizing: 'border-box',
    fill: 'var(--icon-col)',
    '& *': {
      vectorEffect: 'non-scaling-stroke'
    },
    '&.box': {
      padding: 4,
      border: '1px solid var(--white)',
      borderRadius: 8
    },
    '&.medium': {
      '--icon-size': 64
    },
    '&.small': {
      '--icon-size': 32
    },
    '&.small-material': {
      '--icon-size': 24
    },
    '&.tiny': {
      '--icon-size': 16
    },
    '&.red': {
      '--icon-col': 'var(--red)'
    },
    '&.white': {
      '--icon-col': 'white'
    },
    '&.outline-only': {
      fill: 'none',
      stroke: 'var(--icon-col)',
      strokeWidth: 1.5
    }
  }
})


interface IconProps {
  url: string,
  iconSize?: number,
  className?: string
}

function Icon({ iconSize = 24, ...props }: IconProps): JSX.Element {

  const classes = useStyles()

  return (
    <svg
      className={`${classes.icon} ${props.className || ''}`}
      viewBox={`0 0 ${iconSize} ${iconSize}`}
    >
      <use href={props.url}/>
    </svg>
  )
}

export {
  FormField,
  Icon,
  BigAction,
  SlidingPageDialog,
  useStyles as Styles
}
