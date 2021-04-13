import {
  Dialog,
  DialogProps
} from '@material-ui/core'
import ArrowBackIcon from '@material-ui/icons/ArrowBack'
import CloseIcon from '@material-ui/icons/Close'

import { makeStyles } from '@material-ui/styles'

const useStyles = makeStyles({
  slidingPageDialog: {
    minWidth: 500,
    minHeight: 500,
    overflow: 'hidden',
    '& .close-button': {
      position: 'absolute',
      top: 8,
      right: 8,
      height: 24,
      width: 24,
      fontSize: 24,
      color: 'var(--red)',
      cursor: 'pointer'
    },
    '& .back-button': {
      position: 'absolute',
      top: 8,
      left: 8,
      height: 24,
      width: 24,
      fontSize: 24,
      color: 'var(--primary)',
      cursor: 'pointer'
    },
    '& .tab-offset': {
      '--index': '0',
      padding: '1em',
      transform: 'translate3d(calc(var(--index) * -100%), 0, 0)',
      transition: 'transform 400ms var(--ease-out)'
    }
  }
})

export interface SlidingPageDialogProps extends DialogProps { 
  open: boolean,
  tabIndex: number,
  setTabIndex: (index: number) => void,
  onClose: () => void
}

function SlidingPageDialog({ 
  open,
  tabIndex,
  setTabIndex,
  onClose,
  children,
  ...props 
}: SlidingPageDialogProps): JSX.Element {

  const classes = useStyles()

  return (
    <Dialog
      open={ open }
      onClose={ onClose }
      maxWidth={ false }
      { ...props }
    >
      <div className={ `${classes.slidingPageDialog} flex-center` }>
        { tabIndex !== 0 &&
          <div className="back-button flex-center" onClick={ () => { setTabIndex(0) }}>
            <ArrowBackIcon/>
          </div>
        }
        <div className="close-button flex-center" onClick={ onClose }>
          <CloseIcon/>
        </div>
        { /* this is a hack over here */ }
        <div className="tab-offset" style={{ '--index': tabIndex > 0 ? '1' : '0' } as React.CSSProperties }>
          { React.Children.map(children, child => {
            return (
              <div className="page flex-center">
                { child }
              </div>
            ) })
          }
        </div>
      </div>
    </Dialog>
  )
}

export default SlidingPageDialog
