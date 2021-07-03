const path = require('path')

module.exports = {
  apps : [{
    name: 'JDAM',
    script: path.resolve(__dirname, './server.mjs'),
    watch: '.'
  }]
}
