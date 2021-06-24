import './index.css'
import ReactDOM from 'react-dom'
import App from './app'
import JdamClient from './client/jdam_client'

/* place the JdamClient on the global scope */
declare global {
  interface Window { jdamClient: JdamClient }
}

const jdamClient = new JdamClient()

/* this is for debugging purposes only */
window.jdamClient = jdamClient
const username = localStorage.getItem('username') || 'jdam@x.com'
const password = localStorage.getItem('password') || 'testpassword!'
jdamClient.logon(username, password, true)

ReactDOM.render(
  <App client={ jdamClient }/>,
  document.getElementById('root')
)
