import { defineConfig } from 'vite'
import preact from '@preact/preset-vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [preact()],
	server: {
		proxy: {
			"/api": "http://localhost:3030"
		}
	}
})
