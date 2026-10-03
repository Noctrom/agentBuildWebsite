import { Route, Routes } from 'react-router'
import ThemeToggle from './components/ui/ThemeToggle'

// Temporary inline placeholders. dev-2 will replace these with real page
// components from src/pages/ (S6–S10). Layout arrives in S3.
function Placeholder({ title }: { title: string }) {
  return (
    <main className="mx-auto max-w-prose px-gutter py-section">
      <h1 className="text-3xl font-bold text-accent">{title}</h1>
      <p className="mt-2 text-muted">Placeholder page.</p>
    </main>
  )
}

export default function App() {
  return (
    <>
      {/* Temporary: S3 moves the toggle into the header. */}
      <div className="flex justify-end px-gutter pt-4">
        <ThemeToggle />
      </div>
      <Routes>
        <Route path="/" element={<Placeholder title="Home" />} />
        <Route path="/about" element={<Placeholder title="About" />} />
        <Route path="/projects" element={<Placeholder title="Projects" />} />
        <Route path="/resume" element={<Placeholder title="Resume" />} />
        <Route path="/contact" element={<Placeholder title="Contact" />} />
      </Routes>
    </>
  )
}
