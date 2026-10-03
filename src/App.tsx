import { Route, Routes } from 'react-router'

// Temporary inline placeholders. dev-2 will replace these with real page
// components from src/pages/ (S6–S10). Layout/theme arrive in S2–S3.
function Placeholder({ title }: { title: string }) {
  return (
    <main className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-3xl font-bold text-sky-600">{title}</h1>
      <p className="mt-2 text-slate-600">Placeholder page.</p>
    </main>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Placeholder title="Home" />} />
      <Route path="/about" element={<Placeholder title="About" />} />
      <Route path="/projects" element={<Placeholder title="Projects" />} />
      <Route path="/resume" element={<Placeholder title="Resume" />} />
      <Route path="/contact" element={<Placeholder title="Contact" />} />
    </Routes>
  )
}
