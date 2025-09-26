import { defineConfig } from 'vite'
import { readFileSync, readdirSync, statSync } from 'fs'
import { join, extname } from 'path'

function getScripts() {
  const scriptsDir = join(process.cwd(), 'scripts')
  const files = readdirSync(scriptsDir)
  return files
    .filter((file) => extname(file) === '.js')
    .map((file) => ({
      name: file.replace('.js', ''),
      path: join(scriptsDir, file),
    }))
}

export default defineConfig({
  server: {
    port: 3000,
    host: true,
    cors: true,
  },
  configureServer(server) {
    // Serve individual scripts
    server.middlewares.use('/scripts', (req, res, next) => {
      const url = req.url.substring(1) // Remove leading slash
      const scriptPath = join(process.cwd(), 'scripts', url)

      try {
        if (statSync(scriptPath).isFile() && extname(scriptPath) === '.js') {
          const content = readFileSync(scriptPath, 'utf-8')
          res.setHeader('Content-Type', 'application/javascript')
          res.setHeader('Access-Control-Allow-Origin', '*')
          res.end(content)
          return
        }
      } catch (err) {
        // File doesn't exist, continue
      }

      next()
    })

    // Serve scripts list
    server.middlewares.use('/api/scripts', (_, res) => {
      const scripts = getScripts()
      const baseUrl = `http://localhost:3000`

      const scriptList = scripts.map((script) => ({
        name: script.name,
        url: `${baseUrl}/scripts/${script.name}.js`,
        downloadUrl: `${baseUrl}/scripts/${script.name}.js`,
        updateUrl: `${baseUrl}/scripts/${script.name}.js`,
      }))

      res.setHeader('Content-Type', 'application/json')
      res.setHeader('Access-Control-Allow-Origin', '*')
      res.end(JSON.stringify(scriptList, null, 2))
    })
  },
})
