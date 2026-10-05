import type { Project } from './types'

// PLACEHOLDER: replace with real projects. Tags overlap on purpose so the
// projects page filter has something to do.
export const projects: Project[] = [
  {
    id: 'project-alpha',
    title: 'Project Alpha',
    description:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit. A placeholder web app that does placeholder things.',
    tags: ['React', 'TypeScript', 'Tailwind CSS'],
    repoUrl: 'https://github.com/example/project-alpha',
    demoUrl: 'https://alpha.example.com',
    featured: true,
  },
  {
    id: 'project-beta',
    title: 'Project Beta',
    description:
      'Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. A placeholder API service.',
    tags: ['Node.js', 'TypeScript', 'PostgreSQL'],
    repoUrl: 'https://github.com/example/project-beta',
    featured: true,
  },
  {
    id: 'project-gamma',
    title: 'Project Gamma',
    description:
      'Ut enim ad minim veniam, quis nostrud exercitation ullamco. A placeholder data pipeline.',
    tags: ['Python', 'PostgreSQL', 'Docker'],
    repoUrl: 'https://github.com/example/project-gamma',
    demoUrl: 'https://gamma.example.com',
    featured: true,
  },
  {
    id: 'project-delta',
    title: 'Project Delta',
    description:
      'Duis aute irure dolor in reprehenderit in voluptate velit esse. A placeholder command-line tool.',
    tags: ['Python', 'CLI'],
    repoUrl: 'https://github.com/example/project-delta',
    featured: false,
  },
  {
    id: 'project-epsilon',
    title: 'Project Epsilon',
    description:
      'Excepteur sint occaecat cupidatat non proident. A placeholder dashboard with charts.',
    tags: ['React', 'TypeScript', 'Node.js'],
    demoUrl: 'https://epsilon.example.com',
    featured: false,
  },
  {
    id: 'project-zeta',
    title: 'Project Zeta',
    description:
      'Nulla gravida orci a odio, nullam varius turpis. A placeholder containerised microservice.',
    tags: ['Go', 'Docker'],
    repoUrl: 'https://github.com/example/project-zeta',
    featured: false,
  },
]

/** Projects flagged `featured`, in list order. */
export const featuredProjects: Project[] = projects.filter((p) => p.featured)

/** Every distinct tag across all projects, sorted, for the filter bar. */
export const projectTags: string[] = [...new Set(projects.flatMap((p) => p.tags))].sort((a, b) =>
  a.localeCompare(b),
)
