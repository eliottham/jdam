const path = require('path')
const fs = require('fs')
const webpack = require('webpack')
const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin')

module.exports = {
  mode: 'development',
  plugins: [
    new webpack.ProvidePlugin({
      "React": "react"
    }),
    new ForkTsCheckerWebpackPlugin({
      async: false,
      eslint: {
        files: "./src/**/*"
      }
    })
    // new webpack.ProgressPlugin()
  ],
  resolve: {
    extensions: [ ".tsx", ".ts", ".js", ".jsx" ]
  },
  output: {
    path: path.resolve(__dirname, 'public')
  },
  module: {
    rules: [ {
      test: /\.(ts|js)x?$/,
      include: [ path.resolve(__dirname, 'src') ],
      use: [ {
        loader: "babel-loader",
        options: {
          presets: [
            "@babel/preset-env",
            "@babel/preset-react",
            "@babel/preset-typescript"
          ]
        }
      } ]
    }, {
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
  devtool: 'source-map',
  devServer: {
    open: false,
    host: '0.0.0.0',
    contentBase: './public',
    writeToDisk: true,
    port: 4001,
    clientLogLevel: 'error',
    https: {
      key: fs.readFileSync('./jdam.key'),
      cert: fs.readFileSync('./jdam.crt'),
      ca: fs.readFileSync('/etc/ssl/certs/ca-certificates.crt'),
    }
  }
}
