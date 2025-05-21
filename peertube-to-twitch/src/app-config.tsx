import { render } from 'preact'
import './index.css'
import ConfigPage from './pages/config.tsx'
import { StrictMode } from 'preact/compat'

render(<StrictMode>
	<ConfigPage />
</StrictMode>, document.getElementById('app')!)