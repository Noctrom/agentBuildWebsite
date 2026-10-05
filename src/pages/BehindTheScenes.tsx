import { BranchDiagram, Button, PageMeta, Section, StoryFlowDiagram } from '../components/ui'
import { behindTheScenesPage as copy, repoUrl } from '../content'

/** Behind the Scenes: how the site is built by a team of AI agents. */
export default function BehindTheScenes() {
  return (
    <>
      <PageMeta {...copy.meta} />
      <Section title={copy.title} headingLevel={1} intro={copy.intro} />

      <Section title={copy.whyTitle} intro={copy.whyIntro} tone="surface" />

      <Section title={copy.teamTitle}>
        <ul aria-label={copy.teamLabel} className="max-w-prose space-y-3 text-lg text-fg">
          {copy.team.map((member) => (
            <li key={member.name}>
              <span className="font-semibold">{member.name}:</span> {member.description}
            </li>
          ))}
        </ul>
        <p className="mt-6 max-w-prose text-lg text-muted">{copy.teamOutro}</p>
      </Section>

      <Section title={copy.flowTitle} intro={copy.flowIntro} tone="surface">
        <StoryFlowDiagram {...copy.flowDiagram} tone="bg" />
      </Section>

      <Section title={copy.branchesTitle} intro={copy.branchesIntro}>
        <BranchDiagram {...copy.branchDiagram} className="max-w-3xl" />
      </Section>

      <Section title={copy.stackTitle} intro={copy.stackIntro} tone="surface" />

      <Section title={copy.howTitle} intro={copy.howIntro} />

      <Section title={copy.sourceTitle} intro={copy.sourceIntro} tone="surface">
        <Button href={repoUrl}>{copy.sourceButtonLabel}</Button>
      </Section>
    </>
  )
}
