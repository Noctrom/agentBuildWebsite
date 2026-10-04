import { Button, Section } from '../components/ui'
import { contactPage, profile } from '../content'

/** Contact page: call to action, visible email address and social links. No form. */
export default function Contact() {
  const { email, github, linkedin } = profile.links

  return (
    <Section title={contactPage.heading} headingLevel={1} intro={profile.contactCta}>
      <div className="max-w-prose rounded-lg border border-border bg-surface p-5 sm:p-6">
        <p className="text-sm font-medium text-muted">{contactPage.emailLabel}</p>
        <p className="mt-1 text-lg font-semibold break-all text-fg select-all sm:text-xl">
          {email}
        </p>

        <ul aria-label="Contact links" className="mt-6 flex flex-wrap gap-3">
          <li>
            <Button href={`mailto:${email}`}>{contactPage.emailButton}</Button>
          </li>
          <li>
            <Button href={github} variant="secondary">
              {contactPage.githubButton}
            </Button>
          </li>
          <li>
            <Button href={linkedin} variant="secondary">
              {contactPage.linkedinButton}
            </Button>
          </li>
        </ul>
      </div>
    </Section>
  )
}
