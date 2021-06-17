import mime from 'mime-types'

mime.types['flac'] = 'audio/flac'
mime.extensions['audio/flac'] = [ 'flac' ]

export default mime
