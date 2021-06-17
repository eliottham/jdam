import {
  DialogProps
} from '@material-ui/core'
import ArrowBackIcon from '@material-ui/icons/ArrowBack'
import CloseableDialog, { CloseableDialogProps } from './closeable_dialog'

import { makeStyles } from '@material-ui/styles'

const useStyles = makeStyles({
  slidingPageDialog: {
    minWidth: 500,
    minHeight: 500,
    overflow: 'hidden',
    transition: 'height 300ms var(--ease-out)',
    '& .back-button': {
      position: 'absolute',
      top: 8,
      left: 8,
      height: 24,
      width: 24,
      fontSize: 24,
      color: 'var(--primary)',
      cursor: 'pointer',
      zIndex: 200
    },
    '& .tab-offset': {
      '--index': '0',
      margin: '1em',
      transform: 'translate3d(calc(var(--index) * -100%), 0, 0)',
      transition: 'transform 400ms var(--ease-out)',
      display: 'flex',
      '& > .page': {
        height: '100%',
        '&:not(:first-child)': {
          position: 'absolute',
          left: '100%',
          width: '100%'
        }
      }
    }
  }
})

export interface SlidingPageDialogProps { 
  open: boolean,
  tabIndex: number,
  setTabIndex: (index: number) => void,
  onClose: () => void
  height?: number
}

function SlidingPageDialog({ 
  open,
  tabIndex,
  setTabIndex,
  onClose,
  children,
  height = 0,
  ...props 
}: SlidingPageDialogProps & CloseableDialogProps): JSX.Element {

  const classes = useStyles()

  return (
    <CloseableDialog
      open={ open }
      onClose={ onClose }
      maxWidth={ false }
      { ...props }
    >
      <div 
        className={ `${classes.slidingPageDialog} flex-center` } 
        style={ { height } }
      >
        { tabIndex !== 0 &&
          <div 
            className="back-button flex-center" 
            onClick={ () => { setTabIndex(0) } }
          >
            <ArrowBackIcon/>
          </div>
        }
        { /* this is a hack over here */ }
        <div 
          className="tab-offset" 
          style={ { '--index': tabIndex > 0 ? '1' : '0' } as React.CSSProperties }
        >
          { React.Children.map(children, (child, index) => {
            return (
              <div 
                className="page flex-center" 
                style={ { display: index !== tabIndex && index > 0 ? 'none' : '' } }
              >
                { child }
              </div>
            ) })
          }
        </div>
      </div>
    </CloseableDialog>
  )
}

export default SlidingPageDialog
