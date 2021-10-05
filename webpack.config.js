const path = require('path')
const fs = require('fs')
const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin')

module.exports = {
  mode: 'development',
  plugins: [
    new ForkTsCheckerWebpackPlugin({
      async: false,
      eslint: {
        files: "./src/**/*"
      }
    })
    // new webpack.ProgressPlugin()
  ],
  resolve: {
    extensions: [ ".tsx", ".ts", ".js", ".jsx" ],
    modules: [ path.resolve(__dirname, './src'), 'node_modules' ]
  },
  output: {
    path: path.resolve(__dirname, 'public')
  },
  module: {
    rules: [ { 
      test: /\.(ts|js)x?$/,
      loader: "ts-loader",
      options: {
        transpileOnly: true
      }
    },
    {
      test: /\.css$/i,
      use: [ {
        loader: "style-loader"
      }, {
        loader: "css-loader",
        options: {
          sourceMap: true
        }
      } ]
    } ]
  },
  devtool: 'inline-source-map',
  devServer: {
    open: false,
    host: '0.0.0.0',
    static: {
      directory: path.join(__dirname, 'public')
    },
    port: 4001,
    devMiddleware: {
      writeToDisk: true
    },
    https: {
      key: fs.readFileSync('./jdam.key'),
      cert: fs.readFileSync('./jdam.crt'),
      ca: fs.readFileSync('/etc/ssl/certs/ca-certificates.crt')
    }
  }
}
