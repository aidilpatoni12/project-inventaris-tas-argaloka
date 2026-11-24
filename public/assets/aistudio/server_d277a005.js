import { app } from './app.js'
import { config } from './config.js'
import { pool } from './db.js'

try {
  await pool.query('SELECT 1')
  console.log(`[db] Terhubung ke MySQL (${config.db.host}:${config.db.port}/${config.db.database})`)
} catch (e) {
  console.error(`[db] Gagal terhubung ke MySQL: ${e.message}`)
  console.error('     Periksa nilai DB_* di file .env dan pastikan database sudah diimpor.')
  process.exit(1)
}

const server = app.listen(config.port, () => {
  console.log(`[api] Berjalan di http://localhost:${config.port}/api`)
})

const tutup = () => {
  server.close(async () => {
    await pool.end()
    process.exit(0)
  })
}
process.on('SIGINT', tutup)
process.on('SIGTERM', tutup)
