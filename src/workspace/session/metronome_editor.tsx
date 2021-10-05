import React, {
  useEffect,
  useState 
} from 'react'

import {
  IconButton,
  Slider 
} from '@material-ui/core'

import AddIcon from '@material-ui/icons/Add'
import RemoveIcon from '@material-ui/icons/Remove'
import PlayArrowIcon from '@material-ui/icons/PlayArrow'
import StopIcon from '@material-ui/icons/Stop'

import { makeStyles } from '@material-ui/styles'

import { MetronomeFormField } from 'client/forms/session_create_form'

const metroBeatSize = 48

const useStyles = makeStyles({
  metro: {
    gridColumn: '1/span 2',
    display: 'grid',
    gridTemplateAreas: `"remove-beat pattern pattern add-beat"
                        "na1         bpm-label  bpm       na2"
                        "na1         measures  m-slider   na2"`,
    gridTemplateColumns: 'min-content max-content 1fr min-content',
    gridTemplateRows: '1fr minmax(48px, min-content) minmax(48px, min-content)',
    gridGap: '0.2em',
    gridRowGap: '0.5em',
    padding: '1em',
    border: '1px solid var(--lt-grey)',
    borderRadius: 4,
    marginTop: '1em',
    '& > div': {
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center'
    },
    '& .pattern': {
      gridArea: 'pattern',
      justifyContent: 'space-around'
    }
  },
  bpm: {
    gridArea: 'bpm'
  },
  mSlider: {
    gridArea: 'm-slider'
  },
  addSubButton: {
    '&.add': {
      gridArea: 'add-beat'
    },
    '&.sub': {
      gridArea: 'remove-beat'
    },
    '&.MuiIconButton-root': {
      borderRadius: '100%',
      minWidth: metroBeatSize,
      minHeight: metroBeatSize,
      height: metroBeatSize,
      width: metroBeatSize,
      margin: 'auto'
    }
  },
  metroBeat: {
    height: metroBeatSize * 3,
    flex: 1,
    marginRight: 1,
    overflow: 'hidden',
    border: '1px solid var(--lt-grey)',
    borderWidth: '1px 0',
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
    zIndex: 300,
    backgroundColor: 'var(--white)',
    '&:first-child': {
      borderTopLeftRadius: 25,
      borderBottomLeftRadius: 25,
      borderLeftWidth: 1
    },
    '&:last-child': {
      borderTopRightRadius: 25,
      borderBottomRightRadius: 25,
      borderRightWidth: 1
    },
    '& > div': {
      width: '100%',
      lineHeight: `${metroBeatSize}px`,
      textAlign: 'center',
      borderWidth: '1px 0',
      cursor: 'pointer',
      transition: 'all 150ms var(--ease-out), height 200ms var(--ease-out), top 200ms var(--ease-out)',
      '&:first-child': {
        borderWidth: 0,
        '&.selected': {
          backgroundColor: 'var(--red)'
        }
      },
      '&:last-child': {
        borderWidth: 0,
        '&.selected': {
          backgroundColor: 'var(--lt-grey)',
          color: 'var(--black)'
        }
      },
      '&:hover': {
        backgroundColor: 'rgba(var(--primary-s), 0.25)'
      },
      '&.selected': {
        backgroundColor: 'var(--primary)',
        color: 'white',
        zIndex: 200
      }
    }
  }
})

function MetroBeat({ 
  value,
  index,
  onChange 
}: { 
  value: number,
  index: number,
  onChange: (index: number, newValue: number) => void 
}): JSX.Element {

  const classes = useStyles()

  const handleOnClick = (value: number) => {
    return () => {
      onChange(index, value)
    }
  }

  return (
    <div className={ classes.metroBeat }>
      <div className={ value === 2 ? 'selected' : '' } onClick={ handleOnClick(2) } >&#9651;</div>
      <div className={ value === 1 ? 'selected' : '' } onClick={ handleOnClick(1) } >&#9661;</div>
      <div className={ value === 0 ? 'selected' : '' } onClick={ handleOnClick(0) } >&#9711;</div>
    </div>
  )

}

const marks = [
  {
    value: 100,
    label: '8th notes'
  },
  {
    value: 200,
    label: '16th notes'
  }
]

const map = (value: number, mapmin: number, mapmax: number, outmin: number, outmax: number): number => {
  return ((value - mapmin) / (mapmax - mapmin)) * (outmax - outmin) + outmin
}

const scaleFunction = (value: number): { value: number, label: number } => {
  let result = value
  let scale = 1
  if (0 <= value && value <= 100) {
    result = Math.floor(map(value, 0, 100, 60, 280))
    result -= (result % 5)
  } else if (100 < value && value <= 200) {
    result = Math.floor(map(value, 100, 200, 120, 560))
    result -= (result % 5)
    scale = 2
  } else if (200 < value && value <= 300) {
    result = Math.floor(map(value, 200, 300, 240, 1120))
    result -= (result % 10)
    scale = 4
  }
  /* return the nearest mod 5 value */
  return { value: result, label: Math.floor(result / scale) }
}

const unscaleFunction = (value: number): number => {
  let result = value
  if (60 < value && value <= 280) {
    result = map(value, 60, 280, 0, 100)
  } else if (280 < value && value <= 560) {
    result = map(value, 120, 560, 100, 200)
  } else if (560 < value && value <= 1120) {
    result = map(value, 240, 1120, 200, 300)
  }
  return Math.floor(result)
}

interface MetronomeEditorProps {
  model: MetronomeFormField
}

function MetronomeEditor({ model }: MetronomeEditorProps): JSX.Element {

  const classes = useStyles()

  const [ sliderValue, setSliderValue ] = useState(unscaleFunction(model.getValue()?.bpm || 100))
  const [ bpmLabel, setBpmLabel ] = useState(model.getValue()?.bpm || 100)
  const [ pattern, setPattern ] = useState<number[]>(model.getValue()?.pattern || [ 2, 1, 1, 1 ])
  const [ measures, setMeasures ] = useState(4)
  const [ enablePreview, setEnablePreview ] = useState(!!model.metro.clickPrefixName)
  const [ playing, setPlaying ] = useState(model.metro.playing)

  useEffect(() => {
    /* do nothing */  

    const metro = model.metro

    const onGetClicks = () => {
      setEnablePreview(true)
    }

    const onMetroStart = () => {
      setPlaying(true)
    }

    const onMetroStop = () => {
      setPlaying(false)
    }

    metro.getClicks('click')
    metro.on('get-clicks', onGetClicks)
    metro.on('metro-start', onMetroStart)
    metro.on('metro-stop', onMetroStop)
    
    return () => {
      metro.un('get-clicks', onGetClicks)
      metro.un('metro-start', onMetroStart)
      metro.un('metro-stop', onMetroStop)
    }
  }, [ model.metro ])

  const handleSliderChange = (event: Event, newValue: number | number[]) => {
    let value = newValue
    if (Array.isArray(newValue)) { 
      value = newValue[0]
    } else {
      value = newValue
    }
    const { value: scaledValue, label } = scaleFunction(value) 
    setSliderValue(value) 
    setBpmLabel(label)
    model.setBpm(scaledValue)
    model.metro.previewMetroSet({ bpm: scaledValue })
  }

  const handleMeasuresChange = (event: Event, newValue: number | number[]) => {
    let value = newValue
    if (Array.isArray(newValue)) { 
      value = newValue[0]
    } else {
      value = newValue
    }
    setMeasures(value)
    model.setMeasures(value)
  }

  const handleBeatChange = (index: number, newValue: number) => {
    const newPattern = pattern.slice()
    newPattern[index] = newValue
    setPattern(newPattern)
    model.setPattern(newPattern)
    model.metro.previewMetroSet({ pattern: newPattern })
  }

  const handlePatternAdd = () => {
    if (pattern.length < 19) { 
      const newPattern = pattern.concat([ pattern[pattern.length - 1] ])
      setPattern(newPattern)
      model.setPattern(newPattern)
      model.metro.previewMetroSet({ pattern: newPattern })
    }
  }

  const handlePatternRemove = () => {
    if (pattern.length > 1) { 
      const newPattern = pattern.slice(0, -1)
      setPattern(newPattern) 
      model.setPattern(newPattern)
      model.metro.previewMetroSet({ pattern: newPattern })
    }
  }

  const handleOnStart = () => {
    const { value: scaledValue } = scaleFunction(sliderValue) 
    model.metro.previewMetroStart({ bpm: scaledValue, pattern })
  }

  const handleOnStop = () => {
    model.metro.previewMetroStop()
  }

  return (
    <div className={ classes.metro }>
      <IconButton
        onClick={ handlePatternRemove }
        className={ `${classes.addSubButton} sub` }
      >
        <RemoveIcon/>
      </IconButton>
      <div className="pattern">{
        pattern.map((value, index) => {
          return <MetroBeat
            key={ `beat-${index}` }
            index={ index }
            value={ value }
            onChange={ handleBeatChange }
          />
        })
      }</div>
      <IconButton
        onClick={ handlePatternAdd }
        className={ `${classes.addSubButton} add` }
      >
        <AddIcon/>
      </IconButton>
      <div style={ { gridArea: 'bpm-label', minWidth: '8ch', textAlign: 'right' } }>{ bpmLabel } BPM</div>
      <div className={ classes.bpm } >
        <Slider
          color="primary"
          value={ Number(sliderValue) }
          step={ 1 }
          marks={ marks }
          onChange={ handleSliderChange }
          min={ 0 }
          max={ 300 }
          valueLabelDisplay="off"
        />
      </div>
      <div style={ { gridArea: 'measures', minWidth: '8ch', textAlign: 'right' } }>{ measures } BARS</div>
      <div className={ classes.mSlider } >
        <Slider
          color="primary"
          value={ Number(measures) }
          step={ 1 }
          marks
          onChange={ handleMeasuresChange }
          min={ 2 }
          max={ 8 }
          valueLabelDisplay="off"
        />
      </div>
      { enablePreview &&
        <IconButton
          className={ classes.addSubButton }
          style={ { gridArea: 'na1' } }
          disabled={ !enablePreview && playing }
          onClick={ handleOnStop }
        >
          <StopIcon/>
        </IconButton>
      }
      { enablePreview &&
        <IconButton
          className={ classes.addSubButton }
          style={ { gridArea: 'na2' } }
          disabled={ !enablePreview  && !playing }
          onClick={ handleOnStart }
        >
          <PlayArrowIcon/>
        </IconButton>
      }
    </div>
  )
}

export default MetronomeEditor
