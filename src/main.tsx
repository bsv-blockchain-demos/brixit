import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Agentation } from 'agentation'
import App from './App.tsx'
import './index.css'
import 'react-spring-bottom-sheet/dist/style.css'


createRoot(document.getElementById('root')!).render(
  <>
    <StrictMode>
      <App />
    </StrictMode>
    {import.meta.env.DEV && <Agentation />}
  </>,
);
