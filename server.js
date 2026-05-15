const { createServer } = require('https')
const next = require('next')
const fs = require('fs')

const app = next({ dev: true })
const handle = app.getRequestHandler()

const options = {
  key: fs.readFileSync('./certificates/localhost-key.pem'),
  cert: fs.readFileSync('./certificates/localhost.pem'),
}

app.prepare().then(() => {
  createServer(options, (req, res) => {
    handle(req, res)
  }).listen(3000, () => {
    console.log('> Ready on https://localhost:3000')
  })
})
