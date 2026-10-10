import { useEffect, useId, useState } from 'react'
import { LANGUAGES, languageTag, matchLanguage, type LanguageId } from '@shared/languages'
import { Button, Dialog } from '@renderer/components/ui'
import { loadLanguage, translate, useT, type MessageKey } from '@renderer/i18n'
import { useSaveStore } from '@renderer/store/save'
import './LanguagePrompt.css'

/** The language the system is set to, as one of the ten: what the pop-up highlights first. */
function systemLanguage(): LanguageId {
  if (typeof navigator === 'undefined') return matchLanguage([])
  return matchLanguage(navigator.languages?.length ? navigator.languages : [navigator.language])
}

const noop = (): void => {}

/**
 * Asks for the language, once: `App` opens it when the save is loaded and holds no language (a
 * new user, or anyone updating from a version that had none). It cannot be closed without a
 * choice; the choice goes into the save, so it never opens by itself again. Later changes are
 * made in Settings.
 *
 * Its own text is shown in the language that is highlighted, so the user can read the question
 * whatever the app was in before. Text a language does not have yet reads in English.
 */
export function LanguagePrompt({ open }: { open: boolean }) {
  // Renders again when the text of the highlighted language has arrived.
  useT()
  const formId = useId()
  const [choice, setChoice] = useState<LanguageId>(systemLanguage)

  useEffect(() => {
    if (open) void loadLanguage(choice)
  }, [open, choice])

  const tag = languageTag(choice)
  const say = (key: MessageKey): string => translate(choice, key)

  return (
    <Dialog
      open={open}
      onClose={noop}
      dismissable={false}
      hideClose
      size="md"
      title={<span lang={tag}>{say('shell.language.title')}</span>}
      description={<span lang={tag}>{say('shell.language.description')}</span>}
      footer={
        <Button variant="primary" type="submit" form={formId} lang={tag}>
          {say('shell.language.confirm')}
        </Button>
      }
    >
      <form
        id={formId}
        onSubmit={(event) => {
          event.preventDefault()
          useSaveStore.getState().setLanguage(choice)
        }}
      >
        <fieldset className="lang-prompt__list" role="radiogroup" aria-label={say('shell.language.list')}>
          {LANGUAGES.map((language) => (
            <label key={language.id} className="lang-prompt__option" lang={language.tag}>
              <input
                type="radio"
                name={`${formId}-language`}
                value={language.id}
                checked={language.id === choice}
                onChange={() => setChoice(language.id)}
                data-autofocus={language.id === choice ? '' : undefined}
              />
              {language.autonym}
            </label>
          ))}
        </fieldset>
      </form>
    </Dialog>
  )
}
