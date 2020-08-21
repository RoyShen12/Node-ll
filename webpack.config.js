const path = require('path')

const resultConfig = {
  entry: [
    './index.js'
  ],
  output: {
    path: path.resolve(__dirname, 'build'),
    filename: 'll.js'
  },
  target: 'node',
  mode: 'production',
  // externals: {
  //   'mongodb-client-encryption': 'commonjs mongodb-client-encryption'
  // },
  optimization: {
    minimize: false
  }
}

console.log(resultConfig)

module.exports = resultConfig
