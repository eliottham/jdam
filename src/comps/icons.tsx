import { SvgIcon, SvgIconProps } from '@material-ui/core'
import { makeStyles } from '@material-ui/styles'

const useStyles = makeStyles({
  waveform: {
    '&.MuiSvgIcon-root': {
      fill: 'var(--lt-grey)',
      stroke: 'var(--lt-grey)',
      width: '100%',
      height: '50%',
      strokeWidth: '0.2px',
      strokeLinejoin: 'round',
      backgroundImage: 'linear-gradient(0deg, transparent calc(50% - 1px), var(--lt-grey) 50%, transparent calc(50% + 1px))'
    }
  }
})

function NoteIcon(props: SvgIconProps): JSX.Element {
  return (
    <SvgIcon { ...props }>
      <path d="M7.914,17.072l0.005,-11.378c0.001,-0.257 0.171,-0.483 0.418,-0.554l11.557,-3.231c0.175,-0.05 0.362,-0.015 0.507,0.094c0.145,0.109 0.231,0.28 0.231,0.461c-0,0 -0,12.866 -0,12.899c-0,0.942 -1.223,2.433 -2.6,2.798c-1.644,0.436 -3.199,0.283 -3.639,-0.716c-0.441,-1 0.466,-2.368 2.022,-3.054c0.923,-0.406 1.867,-0.482 2.576,-0.269l0,-10.31c0,-0 -9.41,2.682 -9.41,2.682c-0,-0 -0.009,11.649 -0.009,11.667c0.006,0.934 -1.214,2.569 -2.615,2.951c-1.641,0.448 -3.199,0.284 -3.64,-0.716c-0.44,-1 0.466,-2.368 2.023,-3.054c0.921,-0.406 1.865,-0.482 2.574,-0.27Z"/>
    </SvgIcon>
  )
}

function TriRightSmallIcon(props: SvgIconProps): JSX.Element {
  return (
    <SvgIcon { ...props } viewBox="0 0 14 14">
      <path d="M13,7l-6,-6l0,12l6,-6Z" />
    </SvgIcon>
  )
}

function TriLeftSmallIcon(props: SvgIconProps): JSX.Element {
  return (
    <SvgIcon { ...props } viewBox="0 0 14 14">
      <path d="M1,7l6,6l0,-12l-6,6Z" />
    </SvgIcon>
  )
}

function CircleSmallIcon(props: SvgIconProps): JSX.Element {
  return (
    <SvgIcon { ...props } viewBox="0 0 14 14">
      <circle cx="7" cy="9" r="4" />
    </SvgIcon>
  )
}

function WaveformIcon(props: SvgIconProps): JSX.Element {

  const classes = useStyles()

  return (
    <SvgIcon 
      { ...props } 
      className={ `waveform ${props.className ? props.className : ''} ${classes.waveform}` } 
      viewBox="0 0 58 16"
    >
      <path d="M6.5,7.528l1,-1.261l1,0.733l1.233,-4l0.767,1l1,3l1,-2l1,1.267l1,-4.267l1,4.135l1,-2.135l1,3l1,-2l1,1l1,-2l1,4l1,-2l1,1l1,-3l1,1l1,-4l1,6l1,-3l1,-1l1,4l1,1l1,-4l1,1l1,-2l1,3.267l1,-1.267l1,1.267l1,-2.267l1,1l1,2l1,-0.865l1,0.865l1,-1l1,-3l1,1l1,2.267l1,-5.267l1,4l1,-2l1,3.135l1,1.393l5,0.472l-5,0l-1,1l-1,3l-1,-2l-1,1l-1,4l-1,-3l-1,-1l-1,1l-1,-3l-1,0.865l-1,-0.865l-1,2l-1,1l-1,-2.267l-1,1.267l-1,-1.267l-1,3.267l-2,-4l-1,1l-1,0l-1,3l-1,-2l-1,2l-1,1l-1,-3l-1,1l-1,-4l-1,2l-1,-1l-1,4l-1,-2l-1,1l-1,-3l-1,2l-1,-1.135l-1,5.135l-1,-5.267l-1,1.267l-1,-2l-1,1l-0.767,3l-1.233,-4l-1,0.733l-1,-1.733l-5,0l5,-0.472Z"/>
    </SvgIcon>
  )
}

export {
  NoteIcon,
  TriRightSmallIcon,
  TriLeftSmallIcon,
  CircleSmallIcon,
  WaveformIcon
}
