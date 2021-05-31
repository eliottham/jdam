import { SvgIcon, SvgIconProps } from '@material-ui/core'

function NoteIcon(props: SvgIconProps): JSX.Element {
  return (
    <SvgIcon { ...props }>
      <path d="M7.914,17.072l0.005,-10.84c0.001,-0.257 0.171,-0.483 0.418,-0.554l11.072,-3.188c0.174,-0.051 0.362,-0.016 0.507,0.093c0.145,0.109 0.23,0.28 0.23,0.461c0,0 0,12.286 0,12.319c0,0.942 -0.779,2.053 -2.135,2.65c-1.557,0.686 -3.178,0.431 -3.618,-0.568c-0.441,-1 0.466,-2.368 2.022,-3.054c0.923,-0.406 1.867,-0.482 2.576,-0.269l0,-10.31c0,-0 -9.917,2.855 -9.917,2.855c0,0 -0.009,11.649 -0.009,11.667c0.007,0.934 -0.783,2.037 -2.129,2.631c-1.557,0.685 -3.178,0.431 -3.619,-0.569c-0.44,-1 0.466,-2.368 2.023,-3.054c0.921,-0.406 1.865,-0.482 2.574,-0.27Z"/>
    </SvgIcon>
  )
}

export {
  NoteIcon
}