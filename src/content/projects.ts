import type { Project } from './types'

// Chris's real projects (wording approved 2026-10-05, V0.53). None has a repo
// or demo link yet; add `repoUrl` / `demoUrl` once one is public.
export const projects: Project[] = [
  {
    id: 'ecommerce-sales-analysis',
    title: 'E-Commerce Sales Analysis',
    description:
      'In progress. A normalized relational database (customers, orders, order items, products) built from a public Kaggle dataset, with SQL using joins, CTEs and window functions to find top products by monthly revenue, the repeat-customer rate, and products with declining demand. Includes cleaning duplicates, missing values and inconsistent formats.',
    tags: ['SQL', 'MySQL', 'Data Cleaning'],
    featured: true,
  },
  {
    id: 'social-media-app',
    title: 'Social Media App',
    description:
      'A social media app built by a team of six in sprints. I managed account data (usernames, passwords, likes, comments, dislikes) in a NoSQL database and wrote unit tests for compatibility and reliability, with version control on GitHub.',
    tags: ['NoSQL', 'Unit Testing', 'Git', 'Agile'],
    featured: true,
  },
  {
    id: 'this-website',
    title: 'This Website',
    description:
      "The site you're on: a React and TypeScript personal website with an animated space theme, built by a team of AI coding agents I direct (a leader, two developers and a story writer) using user stories, code review and a branch-per-story Git workflow. The Behind the Scenes page shows how it works.",
    tags: ['React', 'TypeScript', 'Tailwind CSS', 'Vite', 'AI Agents'],
    featured: true,
  },
]

/** Projects flagged `featured`, in list order. */
export const featuredProjects: Project[] = projects.filter((p) => p.featured)

/** Every distinct tag across all projects, sorted, for the filter bar. */
export const projectTags: string[] = [...new Set(projects.flatMap((p) => p.tags))].sort((a, b) =>
  a.localeCompare(b),
)
