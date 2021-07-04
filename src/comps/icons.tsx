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

function EditSoundIcon(props: SvgIconProps): JSX.Element {
  return (
    <SvgIcon { ...props }>
      <g id="edit_stops">
        <path d="M11.19,12l-3.737,-3.704l0,7.408l3.737,-3.704Zm1.625,-0l3.736,3.704l0,-7.408l-3.736,3.704Z"/>
        <circle cx="3.33" cy="12" r="2.47"/>
        <circle cx="20.67" cy="12" r="2.47"/>
      </g>
    </SvgIcon>
  )
}

function SoundListIcon(props: SvgIconProps): JSX.Element {
  return (
    <SvgIcon { ...props }>
      <path d="M3,13l2,0l0,-2l-2,0l0,2Zm0,4l2,0l0,-2l-2,0l0,2Zm0,-8l2,0l0,-2l-2,0l0,2Zm4,4l2.021,0l-0,-2l-2.021,0l-0,2Zm-0,4l6.905,0l-2.39,-2l-4.515,0l-0,2Zm-0,-10l-0,2l4.515,0l2.39,-2l-6.905,0Zm5,3.164l-1.836,-0l-0,3.672l1.836,0l5,4.203l0,-12.078l-5,4.203Zm5.9,-4.203c2.602,0.775 4.501,3.187 4.501,6.039c-0,2.852 -1.899,5.264 -4.501,6.039l0,-1.426c1.843,-0.721 3.15,-2.516 3.15,-4.613c0,-2.097 -1.307,-3.892 -3.15,-4.613l0,-1.426Zm0,2.921c1.076,0.623 1.8,1.786 1.8,3.118c0,1.332 -0.724,2.495 -1.8,3.118l0,-1.768c0.283,-0.376 0.45,-0.844 0.45,-1.35c0,-0.506 -0.167,-0.974 -0.45,-1.35l0,-1.768Z"/>
    </SvgIcon>
  )
}

function AssignSoundIcon(props: SvgIconProps): JSX.Element {
  return (
    <SvgIcon { ...props }>
      <path d="M8,3.022l1.5,-0l-0,-1.522l10,-0l0,7l-10,-0l-0,-1.522l-1.5,0l-0,1.789c-0,0.68 0.553,1.233 1.233,1.233l10.534,0c0.68,0 1.233,-0.553 1.233,-1.233l-0,-7.534c-0,-0.68 -0.553,-1.233 -1.233,-1.233l-10.534,0c-0.68,0 -1.233,0.553 -1.233,1.233l-0,1.789Z"/>
      <path d="M12.208,4c0.386,-0.884 1.269,-1.502 2.294,-1.502c1.381,0 2.502,1.121 2.502,2.502c-0,1.381 -1.121,2.502 -2.502,2.502c-1.025,-0 -1.908,-0.618 -2.294,-1.502l-6.959,-0c-0.387,0.884 -1.269,1.502 -2.294,1.502c-1.381,-0 -2.502,-1.121 -2.502,-2.502c-0,-1.381 1.121,-2.502 2.502,-2.502c1.025,0 1.907,0.618 2.294,1.502l6.959,0Zm2.292,-0.279c0.706,-0 1.279,0.573 1.279,1.279c0,0.706 -0.573,1.279 -1.279,1.279c-0.706,0 -1.279,-0.573 -1.279,-1.279c-0,-0.706 0.573,-1.279 1.279,-1.279Zm-11.506,-0c0.706,-0 1.279,0.573 1.279,1.279c0,0.706 -0.573,1.279 -1.279,1.279c-0.706,0 -1.279,-0.573 -1.279,-1.279c0,-0.706 0.573,-1.279 1.279,-1.279Z"/>
    </SvgIcon>
  )
}

export {
  NoteIcon,
  TriRightSmallIcon,
  TriLeftSmallIcon,
  CircleSmallIcon,
  WaveformIcon,
  EditSoundIcon,
  SoundListIcon,
  AssignSoundIcon
}
