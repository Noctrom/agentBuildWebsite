import { Button, Card, Section } from '../components/ui'
import {
  education,
  experience,
  formatYearMonth,
  profile,
  resumePage,
  sharedLabels,
  type YearMonth,
} from '../content'

/** Start–end dates as `<time>` elements; `end: null` shows the "Present" label. */
function DateRange({ start, end }: { start: YearMonth; end: YearMonth | null }) {
  return (
    <p className="text-sm text-muted">
      <time dateTime={start}>{formatYearMonth(start)}</time>
      {' – '}
      {end === null ? sharedLabels.present : <time dateTime={end}>{formatYearMonth(end)}</time>}
    </p>
  )
}

/** Resume page: summary of experience and education plus a PDF download. */
export default function Resume() {
  return (
    <>
      <Section title={resumePage.title} headingLevel={1} intro={resumePage.intro}>
        <Button href={profile.resumeUrl} download>
          {resumePage.downloadLabel}
        </Button>
      </Section>

      <Section
        title={resumePage.experienceTitle}
        intro={resumePage.experienceIntro}
        className="pt-0"
      >
        <ol className="space-y-6">
          {experience.map((job) => (
            <li key={job.id}>
              <Card
                title={job.role}
                description={
                  <>
                    <p>
                      <span className="font-medium text-accent">{job.company}</span>
                      {job.location && <> · {job.location}</>}
                    </p>
                    <DateRange start={job.start} end={job.end} />
                    <p className="mt-3 max-w-prose text-base text-fg">{job.summary}</p>
                    {job.highlights && job.highlights.length > 0 && (
                      <ul
                        aria-label={resumePage.highlightsLabel}
                        className="mt-3 max-w-prose list-disc space-y-1 pl-5 text-base text-fg marker:text-accent"
                      >
                        {job.highlights.map((highlight) => (
                          <li key={highlight}>{highlight}</li>
                        ))}
                      </ul>
                    )}
                  </>
                }
              />
            </li>
          ))}
        </ol>
      </Section>

      <Section
        title={resumePage.educationTitle}
        intro={resumePage.educationIntro}
        className="pt-0"
      >
        <ol className="space-y-6">
          {education.map((entry) => (
            <li key={entry.id}>
              <Card
                title={entry.degree}
                description={
                  <>
                    <p className="font-medium text-accent">{entry.institution}</p>
                    <DateRange start={entry.start} end={entry.end} />
                    {entry.details && (
                      <p className="mt-3 max-w-prose text-base text-fg">{entry.details}</p>
                    )}
                  </>
                }
              />
            </li>
          ))}
        </ol>
      </Section>
    </>
  )
}
