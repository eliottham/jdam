import CloseIcon from '@material-ui/icons/Close'

import { makeStyles } from '@material-ui/styles'

const useStyles = makeStyles({
  root: {
    position: 'absolute',
    top: 8,
    right: 8,
    height: 24,
    width: 24,
    fontSize: 24,
    color: 'var(--primary)',
    cursor: 'pointer',
    zIndex: 200
  }
})

function CloseButton({ onClick }: { onClick: () => void }) {

  const classes = useStyles()

  return (
    <div className={ classes.root + " flex-center" } onClick={ onClick }>
      <CloseIcon/>
    </div>
  )
}

export default CloseButton
