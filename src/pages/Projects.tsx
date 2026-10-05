import { useState } from 'react'
import { projects, projectsPage, projectTags, sharedLabels, type Project } from '../content'
import { Card, Section, TagButton, type CardAction } from '../components/ui'

function projectActions(project: Project): CardAction[] {
  const actions: CardAction[] = []
  if (project.repoUrl) actions.push({ label: sharedLabels.projectRepo, href: project.repoUrl })
  if (project.demoUrl) {
    actions.push({ label: sharedLabels.projectDemo, href: project.demoUrl, variant: 'primary' })
  }
  return actions
}

/** Projects page: tag filter plus a responsive grid of project cards. */
export default function Projects() {
  const [activeTag, setActiveTag] = useState<string | null>(null)

  const visible = activeTag ? projects.filter((p) => p.tags.includes(activeTag)) : projects

  return (
    <Section title={projectsPage.title} headingLevel={1} intro={projectsPage.intro}>
      <div
        role="group"
        aria-label={projectsPage.filterLabel}
        className="flex flex-wrap gap-2"
      >
        <TagButton pressed={activeTag === null} onClick={() => setActiveTag(null)}>
          {projectsPage.allLabel}
        </TagButton>
        {projectTags.map((tag) => (
          <TagButton
            key={tag}
            pressed={activeTag === tag}
            onClick={() => setActiveTag(activeTag === tag ? null : tag)}
          >
            {tag}
          </TagButton>
        ))}
      </div>

      <p aria-live="polite" className="mt-4 text-sm text-muted">
        {projectsPage.resultCount(visible.length, projects.length)}
      </p>

      <ul className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((project) => (
          <li key={project.id}>
            <Card
              title={project.title}
              description={project.description}
              image={project.image ? { src: project.image, alt: '' } : undefined}
              tags={project.tags}
              actions={projectActions(project)}
              headingLevel={2}
            />
          </li>
        ))}
      </ul>
    </Section>
  )
}
