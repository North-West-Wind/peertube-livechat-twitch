import { defineConfig } from 'vite'
import preact from '@preact/preset-vite'
import { resolve } from "path";

// https://vite.dev/config/
export default defineConfig({
	base: "./",
  plugins: [preact()],
	server: {
		port: 8080
	},
	build: {
		modulePreload: {
			polyfill: false,
		},
		rollupOptions: {
			input: {
				config: resolve(__dirname, "config.html"),
				chat: resolve(__dirname, "chat.html"),
			},
		}
	}
})
