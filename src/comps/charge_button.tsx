import { useRef, useEffect } from 'react'
import { makeStyles } from '@material-ui/styles'

interface ChargeButtonProps extends React.HTMLAttributes<HTMLDivElement> {
  onConfirm: () => void
  chargeRate?: number /* we'll call a rate of 1 = 1 second to charge fully */
}

const useStyles = makeStyles({
  root: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
    cursor: 'pointer',
    '&::before': {
      content: '""',
      position: 'absolute',
      right: 0,
      left: 0,
      bottom: 0,
      height: 'var(--fac)'
    }
  }
})

function ChargeButton({ onConfirm, chargeRate = 1, className, ...props }: ChargeButtonProps) {

  const ref = useRef<HTMLDivElement>(null)
  const classes = useStyles()

  useEffect(() => {

    const current = ref.current

    if (!current) { return }

    let chargeFac = 0
    let lastTime = 0
    let charging = false
    let frameId = 0

    const chargeUp = (time: number) => {
      if (!current) { return }
      const diff = time - lastTime
      const lastFac = chargeFac
      lastTime = time
      chargeFac += (charging ? diff : (-diff * 2.5)) * chargeRate / 1000

      if (chargeFac > 1.0) {
        chargeFac = 1.0
      } else if (chargeFac < 0.0) {
        chargeFac = 0.0
      }

      current.style.setProperty('--fac', `${chargeFac * 100}%`)

      if (charging || (chargeFac > 0.0 && chargeFac < 1.0)) {
        frameId = window.requestAnimationFrame(chargeUp) 
      } 

      if (lastFac !== chargeFac) {
        if (chargeFac >= 1.0) {
          current.classList.add('charged')
          current.classList.remove('charging')
        } else if (chargeFac > 0) {
          current.classList.remove('charged')
          current.classList.add('charging')
        } else {
          current.classList.remove('charging')
        }
      }

    }

    const onMouseDown = () => {
      if (!current) { return }
      charging = true
      lastTime = performance.now() 
      window.cancelAnimationFrame(frameId)
      chargeUp(lastTime)
    }

    const onMouseUp = () => {
      charging = false
      if (chargeFac >= 1.0) {
        window.cancelAnimationFrame(frameId)
        chargeFac = 0
        onConfirm()
      }
    }

    const onMouseLeave = () => {
      charging = false
    }

    current.addEventListener('mousedown', onMouseDown)
    current.addEventListener('mouseup', onMouseUp)
    current.addEventListener('mouseleave', onMouseLeave)

    return () => {
      current.removeEventListener('mousedown', onMouseDown)
      current.removeEventListener('mouseup', onMouseUp)
      current.removeEventListener('mouseleave', onMouseLeave)
      window.cancelAnimationFrame(frameId)
    }
  })

  return (
    <div
      ref={ ref }
      { ...props }
      className={ classes.root + ` charge-button ${className ? className : ''}` }
    >
    </div>
  )
}

export default ChargeButton
