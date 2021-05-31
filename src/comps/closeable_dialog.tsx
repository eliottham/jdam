import {
  Dialog,
  DialogProps
} from '@material-ui/core'

import CloseButton from './close_button'

function CloseableDialog({ children, ...props }: DialogProps) {
  return (
    <Dialog
      { ...props }
    >
      <CloseButton onClick={ () => { props.onClose?.({}, 'backdropClick') } }/> 
      { children }
    </Dialog>
  )
}

export default CloseableDialog
