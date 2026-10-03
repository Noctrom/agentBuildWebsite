import { Route, Routes } from 'react-router'
import Layout from './components/layout/Layout'

// Temporary inline placeholders. dev-2 will replace these with real page
// components from src/pages/ (S6–S10). Pages render inside Layout's <main>.
function Placeholder({ title }: { title: string }) {
  return (
    <div className="mx-auto max-w-prose px-gutter py-section">
      <h1 className="text-3xl font-bold text-accent">{title}</h1>
      <p className="mt-2 text-muted">Placeholder page.</p>
    </div>
  )
}

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Placeholder title="Home" />} />
        <Route path="/about" element={<Placeholder title="About" />} />
        <Route path="/projects" element={<Placeholder title="Projects" />} />
        <Route path="/resume" element={<Placeholder title="Resume" />} />
        <Route path="/contact" element={<Placeholder title="Contact" />} />
      </Route>
    </Routes>
  )
}
