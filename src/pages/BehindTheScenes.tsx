import { BranchDiagram, Button, PageMeta, Section, StoryFlowDiagram } from '../components/ui'
import { glassClass } from '../components/ui/tone'
import { behindTheScenesPage as copy, repoUrl } from '../content'

/*
 * Spacing (V0.46): every gap between sections is the same, one
 * `--spacing-section` (64px) from the last line of one section to the next
 * heading. Each section gets half of it above and half below, so the gap is
 * the same with or without a band edge in between, and inside the band the
 * space above the first heading equals the space below the last content.
 * The page's outer edges (above the title, below the last section) keep the
 * full `py-section` like every other page.
 */
const half = 'pt-[calc(var(--spacing-section)/2)] pb-[calc(var(--spacing-section)/2)]'
const first = 'pb-[calc(var(--spacing-section)/2)]'
const last = 'pt-[calc(var(--spacing-section)/2)]'

/**
 * One frosted band around the two process diagrams (How work flows, Branches
 * and reviews), same glass recipe as `Section tone="surface"`, with no line
 * between the two sections. Sections inside stay `tone="default"`, so their
 * text is styled exactly like the plain sections. `-my-px` cancels the
 * band's 1px top and bottom border, so a gap across a band edge stays 64px.
 */
const bandClass = `-my-px glass-edge border-y border-border ${glassClass.surface}`

/** Behind the Scenes: how the site is built by a team of AI agents. */
export default function BehindTheScenes() {
  return (
    <>
      <PageMeta {...copy.meta} />
      <Section title={copy.title} headingLevel={1} intro={copy.intro} className={first} />

      <Section title={copy.whyTitle} intro={copy.whyIntro} className={half} />

      <Section title={copy.teamTitle} className={half}>
        <ul aria-label={copy.teamLabel} className="max-w-prose space-y-3 text-lg text-fg">
          {copy.team.map((member) => (
            <li key={member.name}>
              <span className="font-semibold">{member.name}:</span> {member.description}
            </li>
          ))}
        </ul>
        <p className="mt-6 max-w-prose text-lg text-muted">{copy.teamOutro}</p>
      </Section>

      <div className={bandClass}>
        <Section title={copy.flowTitle} intro={copy.flowIntro} className={half}>
          <StoryFlowDiagram {...copy.flowDiagram} tone="bg" />
        </Section>

        <Section title={copy.branchesTitle} intro={copy.branchesIntro} className={half}>
          <BranchDiagram {...copy.branchDiagram} tone="bg" className="max-w-3xl" />
        </Section>
      </div>

      <Section title={copy.stackTitle} intro={copy.stackIntro} className={half} />

      <Section title={copy.howTitle} intro={copy.howIntro} className={half} />

      <Section title={copy.sourceTitle} intro={copy.sourceIntro} className={last}>
        <Button href={repoUrl}>{copy.sourceButtonLabel}</Button>
      </Section>
    </>
  )
}
