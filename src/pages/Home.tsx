import { useId } from 'react'
import { Button, Card, Container, PageMeta, Section, type CardAction } from '../components/ui'
import { featuredProjects, homePage, profile, sharedLabels, type Project } from '../content'

/** The home page previews at most this many featured projects. */
const MAX_FEATURED = 3

function projectActions(project: Project): CardAction[] {
  const actions: CardAction[] = []
  if (project.repoUrl) actions.push({ label: sharedLabels.projectRepo, href: project.repoUrl })
  if (project.demoUrl) actions.push({ label: sharedLabels.projectDemo, href: project.demoUrl })
  return actions
}

export default function Home() {
  const heroHeadingId = `${useId()}-hero-heading`
  const featured = featuredProjects.slice(0, MAX_FEATURED)

  return (
    <>
      <PageMeta {...homePage.meta} />
      {/* Hero: custom layout (text beside photo), so not a Section, but it uses
          the shared Container so its edges match the header and sections. */}
      <section aria-labelledby={heroHeadingId} className="py-section">
        <Container className="flex flex-col-reverse items-center gap-10 md:flex-row md:justify-between">
          <div className="text-center md:text-left">
            <h1
              id={heroHeadingId}
              className="text-4xl font-bold tracking-tight text-fg sm:text-5xl"
            >
              {profile.name}
            </h1>
            <p className="mt-3 text-xl font-medium text-accent sm:text-2xl">{profile.title}</p>
            <p className="mx-auto mt-4 max-w-prose text-lg text-muted md:mx-0">
              {profile.pitch}
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3 md:justify-start">
              <Button to="/projects">{homePage.viewProjectsLabel}</Button>
              <Button href={profile.resumeUrl} download variant="secondary">
                {homePage.downloadResumeLabel}
              </Button>
            </div>
          </div>
          <img
            src={profile.photo}
            alt={profile.photoAlt}
            width={400}
            height={400}
            className="size-40 shrink-0 rounded-full border border-border bg-surface object-cover sm:size-56 md:size-64"
          />
        </Container>
      </section>

      {featured.length > 0 && (
        <Section title={homePage.featuredTitle} intro={homePage.featuredIntro} className="pt-0">
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((project) => (
              <li key={project.id}>
                <Card
                  title={project.title}
                  description={project.description}
                  image={project.image ? { src: project.image, alt: '' } : undefined}
                  tags={project.tags}
                  actions={projectActions(project)}
                />
              </li>
            ))}
          </ul>
          <div className="mt-8">
            <Button to="/projects" variant="secondary">
              {homePage.seeAllProjectsLabel}
            </Button>
          </div>
        </Section>
      )}
    </>
  )
}
