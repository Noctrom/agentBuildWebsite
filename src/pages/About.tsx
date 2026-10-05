import { Section, Tag } from '../components/ui'
import { aboutPage, experience, formatYearMonth, profile, sharedLabels, skills } from '../content'

export default function About() {
  return (
    <>
      <Section title={aboutPage.title} headingLevel={1}>
        <div className="max-w-prose space-y-4 text-lg text-fg">
          {profile.bio.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>
      </Section>

      <Section title={aboutPage.skillsTitle} intro={aboutPage.skillsIntro} tone="surface">
        <div className="grid gap-8 sm:grid-cols-2">
          {skills.map((group) => (
            <div key={group.category}>
              <h3 className="text-lg font-semibold text-fg">{group.category}</h3>
              <ul aria-label={group.category} className="mt-3 flex flex-wrap gap-2">
                {group.skills.map((skill) => (
                  <li key={skill}>
                    <Tag className="bg-bg">{skill}</Tag>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Section>

      <Section title={aboutPage.experienceTitle} intro={aboutPage.experienceIntro}>
        <ol className="space-y-10 border-l border-border pl-6">
          {experience.map((job) => (
            <li key={job.id} className="relative">
              <span
                aria-hidden="true"
                className="absolute top-1.5 -left-[1.90625rem] size-3 rounded-full border-2 border-bg bg-accent"
              />
              <h3 className="text-lg font-semibold text-fg">{job.role}</h3>
              <p className="text-muted">
                <span className="font-medium text-accent">{job.company}</span>
                {job.location && <> · {job.location}</>}
              </p>
              <p className="mt-1 text-sm text-muted">
                <time dateTime={job.start}>{formatYearMonth(job.start)}</time>
                {' – '}
                {job.end === null ? (
                  sharedLabels.present
                ) : (
                  <time dateTime={job.end}>{formatYearMonth(job.end)}</time>
                )}
              </p>
              <p className="mt-3 max-w-prose text-fg">{job.summary}</p>
            </li>
          ))}
        </ol>
      </Section>
    </>
  )
}
