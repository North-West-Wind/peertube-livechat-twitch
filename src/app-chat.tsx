import { render } from 'preact'
import './index.css'
import ChatPage from './pages/chat.tsx'
import { StrictMode } from 'preact/compat'

render(<StrictMode>
	<ChatPage />
</StrictMode>, document.getElementById('app')!)