import { Button, PageMeta, Section } from '../components/ui'
import { glassClass } from '../components/ui/tone'
import { contactPage, profile } from '../content'

/** Contact page: call to action, visible email address and social links. No form. */
export default function Contact() {
  const { email, github, linkedin } = profile.links

  return (
    <>
      <PageMeta {...contactPage.meta} />
      <Section title={contactPage.title} headingLevel={1} intro={profile.contactCta}>
        {/* Frosted panel matching Card (S25 glass). Sized to its content, so on
            tablet and desktop it stays clear of the galaxy to its right (S28). */}
        <div
          className={`glass-edge w-fit max-w-full rounded-lg border border-border p-5 sm:p-6 ${glassClass.surface}`}
        >
          <p className="text-sm font-medium text-muted">{contactPage.emailLabel}</p>
          <p className="mt-1 text-lg font-semibold break-all text-fg select-all sm:text-xl">
            {email}
          </p>

          <ul aria-label={contactPage.linksLabel} className="mt-6 flex flex-wrap gap-3">
            <li>
              <Button href={`mailto:${email}`}>{contactPage.emailButtonLabel}</Button>
            </li>
            <li>
              <Button href={github} variant="secondary">
                {contactPage.githubButtonLabel}
              </Button>
            </li>
            <li>
              <Button href={linkedin} variant="secondary">
                {contactPage.linkedinButtonLabel}
              </Button>
            </li>
          </ul>
        </div>
      </Section>
    </>
  )
}
