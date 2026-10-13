import { AppRouter } from '@/presentation/routes/router'
import { useCursorSpotlight } from '@/presentation/hooks/use-cursor-spotlight'

function App() {
  // One global listener feeds the cursor spotlight on every interactive card.
  useCursorSpotlight()
  return <AppRouter />
}

export default App
