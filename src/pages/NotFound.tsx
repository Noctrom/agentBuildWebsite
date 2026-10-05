import { Button, PageMeta, Section } from '../components/ui'
import { notFoundPage } from '../content'

/** 404 page: rendered by the catch-all route for any unknown URL. */
export default function NotFound() {
  return (
    <>
      <PageMeta {...notFoundPage.meta} />
      <Section title={notFoundPage.title} headingLevel={1} intro={notFoundPage.intro}>
        <Button to="/">{notFoundPage.homeLabel}</Button>
      </Section>
    </>
  )
}
