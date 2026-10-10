/**
 * Development-only gallery of every shared component in its states (route "/_kit").
 * It is the reference for feature work: copy usage from here.
 */

import { useMemo, useRef, useState, type ReactNode } from 'react'
import { BALLS } from '@shared/balls'
import { FORM_CATEGORY_LABELS } from '@renderer/components/pokemon'
import type { FormCategory } from '@shared/dex-types'
import { GAMES, SYSTEMS } from '@shared/games'
import type { CatchEntry } from '@shared/save-types'
import {
  BallIcon,
  DexNumber,
  ENTRY_CARD_METRICS,
  EntryCard,
  EntryRowHeader,
  FormCategoryTag,
  GameBadge,
  GameIcon,
  GenderIcon,
  ShinyMark,
  Sprite,
  SpriteStage,
  SystemIcon,
  TYPE_IDS,
  TypeBadge,
  TypeBadges,
  typeColor
} from '@renderer/components/pokemon'
import {
  Badge,
  Button,
  Checkbox,
  Chip,
  Combobox,
  DateField,
  Dialog,
  Drawer,
  EmptyState,
  ErrorBoundary,
  HudBrackets,
  Icon,
  ICON_NAMES,
  IconButton,
  Kbd,
  Leds,
  Lens,
  Menu,
  NumberField,
  NumberTicker,
  Panel,
  ProgressBar,
  ProgressRing,
  SegmentedControl,
  Select,
  Skeleton,
  Spinner,
  Switch,
  TabPanel,
  Tabs,
  Tag,
  TextArea,
  TextField,
  Tooltip,
  VirtualGrid,
  type SelectOption,
  type Tone,
  type VirtualGridHandle
} from '@renderer/components/ui'
import { burst, countUp, enterStagger, flipIn, pageEnter, popIn, pulse, shake, useAnimeScope, animate, stagger } from '@renderer/lib/anim'
import { useDex } from '@renderer/lib/data'
import { deleteEntryWithUndo, duplicateEntryWithToast, editEntry, entrySummary, openEntrySpecies } from '@renderer/lib/entry-actions'
import { dexNo, plural, todayIso } from '@renderer/lib/format'
import { BootError, BootScreen } from '@renderer/shell/BootScreen'
import { useEntries, useSaveStore, useSettings } from '@renderer/store/save'
import { toast, useUiStore } from '@renderer/store/ui'
import { Row, Section } from './parts'
import { UpdatesKit } from './UpdatesKit'
import './KitPage.css'

const TONES: Tone[] = ['neutral', 'accent', 'gold', 'catch', 'success', 'warning', 'danger']
const SWATCHES: Array<[string, string[]]> = [
  ['Background', ['--bg-0', '--bg-1', '--bg-2', '--bg-3', '--surface-solid', '--surface-solid-2']],
  ['Glass', ['--surface-1', '--surface-2', '--surface-3', '--surface-hover', '--surface-inset']],
  ['Text', ['--text-1', '--text-2', '--text-3', '--text-disabled']],
  ['Accent', ['--accent-1', '--accent-2', '--accent-3', '--accent', '--accent-soft']],
  ['Semantic', ['--catch', '--gold', '--success', '--warning', '--danger', '--male', '--female']]
]
const FORM_CATS = Object.keys(FORM_CATEGORY_LABELS) as FormCategory[]

// ---------------------------------------------------------------- sections

function Foundations() {
  return (
    <>
      <Section id="colour" title="Colour tokens" note="styles/tokens.css - identical names in both themes">
        <div className="kit-swatches">
          {SWATCHES.map(([group, names]) => (
            <div key={group} className="kit-swatch-group">
              <div className="u-eyebrow">{group}</div>
              <div className="kit-swatch-row">
                {names.map((name) => (
                  <div key={name} className="kit-swatch">
                    <span className="kit-swatch__chip" style={{ background: `var(${name})` }} />
                    <code>{name}</code>
                  </div>
                ))}
              </div>
            </div>
          ))}
          <div className="kit-swatch-group">
            <div className="u-eyebrow">Gradients</div>
            <div className="kit-swatch-row">
              {['--accent-grad', '--catch-grad', '--gold-grad', '--danger-grad'].map((name) => (
                <div key={name} className="kit-swatch">
                  <span className="kit-swatch__chip kit-swatch__chip--wide" style={{ background: `var(${name})` }} />
                  <code>{name}</code>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Section>

      <Section id="type" title="Typography" note="Outfit Variable, tabular numerals">
        <Panel>
          <div className="kit-type">
            <div style={{ fontSize: 'var(--fs-display)', fontWeight: 800, lineHeight: 1.05, letterSpacing: 'var(--tracking-display)' }}>Garchomp</div>
            <div style={{ fontSize: 'var(--fs-4xl)', fontWeight: 700, lineHeight: 1.1 }}>
              <span className="u-accent-text">1,025</span> species charted
            </div>
            <div className="page-title">Page title - fs-3xl / bold</div>
            <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 600 }}>Heading - fs-2xl / semibold</div>
            <div className="section-title">Section title - fs-lg / semibold</div>
            <div>Body - fs-md. Logged in Scarlet at South Province (Area One), Lv. 3-7, in a Quick Ball.</div>
            <div className="u-muted" style={{ fontSize: 'var(--fs-sm)' }}>
              Secondary - fs-sm, text-2. 0123456789 / 1,367 / 37.5%
            </div>
            <div className="u-eyebrow">Eyebrow label - 11 px caps</div>
          </div>
        </Panel>
      </Section>
    </>
  )
}

function Buttons() {
  const [loading, setLoading] = useState(false)
  const [pressed, setPressed] = useState(true)
  return (
    <Section id="buttons" title="Button and IconButton">
      <Panel>
        <Row label="Variants">
          <Button variant="primary" icon="plus">
            Primary
          </Button>
          <Button variant="catch" icon="pokeball">
            Log catch
          </Button>
          <Button variant="subtle" icon="filter">
            Subtle
          </Button>
          <Button variant="ghost" iconEnd="chevron-right">
            Ghost
          </Button>
          <Button variant="danger" icon="trash">
            Delete
          </Button>
        </Row>
        <Row label="Sizes">
          <Button variant="primary" size="sm">
            Small
          </Button>
          <Button variant="primary" size="md">
            Medium
          </Button>
          <Button variant="primary" size="lg">
            Large
          </Button>
          <Button variant="catch" size="sm" icon={<BallIcon ball={4} size={16} label="" />}>
            With a ball
          </Button>
          <Button variant="catch" size="lg" icon={<BallIcon ball={2} size={22} label="" />}>
            Log catch
          </Button>
        </Row>
        <Row label="States">
          <Button variant="primary" disabled>
            Disabled
          </Button>
          <Button variant="subtle" disabled>
            Disabled
          </Button>
          <Button
            variant="primary"
            icon="download"
            loading={loading}
            onClick={() => {
              setLoading(true)
              setTimeout(() => setLoading(false), 1600)
            }}
          >
            {loading ? 'Exporting' : 'Click to load'}
          </Button>
          <Button variant="catch" loading>
            Saving
          </Button>
          <div style={{ width: 220 }}>
            <Button variant="subtle" block icon="upload">
              Block
            </Button>
          </div>
        </Row>
        <Row label="Icon buttons">
          <IconButton icon="edit" label="Edit entry" />
          <IconButton icon="trash" label="Delete entry" variant="danger" />
          <IconButton icon="filter" label="Filters" variant="subtle" />
          <IconButton icon="plus" label="Add" variant="primary" />
          <IconButton icon="pokeball" label="Log catch" variant="catch" round />
          <IconButton icon="sparkle" label="Shiny view" pressed={pressed} onClick={() => setPressed(!pressed)} />
          <IconButton icon="more" label="More" size="sm" />
          <IconButton icon="search" label="Search" size="lg" variant="subtle" />
          <IconButton icon="refresh" label="Refreshing" loading />
          <IconButton icon="lock" label="Locked" disabled />
        </Row>
      </Panel>
    </Section>
  )
}

function ChipsAndBadges() {
  const [selected, setSelected] = useState<Set<string>>(new Set(['Shiny', 'Kanto']))
  const [tokens, setTokens] = useState(['Scarlet', 'Violet', 'Legends: Z-A'])
  const toggle = (name: string): void => {
    const next = new Set(selected)
    if (next.has(name)) next.delete(name)
    else next.add(name)
    setSelected(next)
  }
  return (
    <Section id="chips" title="Chip, Tag and Badge">
      <Panel>
        <Row label="Soft">
          {TONES.map((tone) => (
            <Chip key={tone} tone={tone}>
              {tone}
            </Chip>
          ))}
        </Row>
        <Row label="Outline / solid">
          {TONES.map((tone) => (
            <Chip key={tone} tone={tone} variant="outline">
              {tone}
            </Chip>
          ))}
          {TONES.map((tone) => (
            <Chip key={`s-${tone}`} tone={tone} variant="solid">
              {tone}
            </Chip>
          ))}
        </Row>
        <Row label="Filter chips (toggle)">
          {['Shiny', 'Kanto', 'Legendary', 'Uncaught'].map((name) => (
            <Chip key={name} tone={name === 'Shiny' ? 'gold' : 'neutral'} icon={name === 'Shiny' ? 'sparkle' : undefined} selected={selected.has(name)} onClick={() => toggle(name)}>
              {name}
            </Chip>
          ))}
          <Chip onClick={() => {}} disabled>
            Disabled
          </Chip>
        </Row>
        <Row label="Removable / custom colour">
          {tokens.map((t) => (
            <Chip key={t} tone="accent" onRemove={() => setTokens(tokens.filter((x) => x !== t))} removeLabel={`Remove ${t}`}>
              {t}
            </Chip>
          ))}
          <Button variant="ghost" size="sm" onClick={() => setTokens(['Scarlet', 'Violet', 'Legends: Z-A'])}>
            Reset
          </Button>
          <Chip color="var(--type-dragon)">Custom colour</Chip>
          <Chip color={GAMES[41]?.color}>Game colour</Chip>
        </Row>
        <Row label="Tags (small)">
          <Tag>Wild</Tag>
          <Tag tone="accent" icon="map-pin">
            Route 1
          </Tag>
          <Tag tone="gold" icon="sparkle">
            Shiny locked
          </Tag>
          <Tag tone="catch">Alpha</Tag>
          <Tag tone="success" icon="check">
            Caught
          </Tag>
          <Tag tone="warning">Event</Tag>
          <Tag variant="outline">Lv. 3-7</Tag>
        </Row>
        <Row label="Badges">
          <Badge count={3} />
          <Badge count={128} />
          <Badge count={12} tone="gold" />
          <Badge count={7} tone="catch" />
          <Badge tone="success">NEW</Badge>
          <Badge dot label="Unread" />
          <Badge dot tone="catch" label="Attention" />
          <Badge dot tone="gold" label="Shiny" />
        </Row>
      </Panel>
    </Section>
  )
}

function Panels() {
  return (
    <Section id="panels" title="Panel / Card" note="glass surface, optional chamfer and HUD brackets">
      <div className="kit-grid kit-grid--3">
        <Panel title="Glass (default)" eyebrow="tone=glass" actions={<IconButton icon="more" label="More" size="sm" />}>
          <p className="u-muted">White at 4% over the navy stack with a hairline border and an inner highlight.</p>
        </Panel>
        <Panel tone="solid" title="Solid" eyebrow="tone=solid">
          <p className="u-muted">Opaque, for content that floats or needs the contrast.</p>
        </Panel>
        <Panel tone="inset" title="Inset" eyebrow="tone=inset">
          <p className="u-muted">A well: stat tiles, wells for sprites, grouped rows.</p>
        </Panel>
        <Panel tone="accent" title="Accent" eyebrow="tone=accent">
          <p className="u-muted">Highlights the one panel that matters on a page.</p>
        </Panel>
        <Panel tone="gold" title="Gold" eyebrow="tone=gold">
          <p className="u-muted">Shiny and achievement surfaces.</p>
        </Panel>
        <Panel interactive title="Interactive" eyebrow="interactive" tabIndex={0}>
          <p className="u-muted">Lifts on hover; for panels that act as links.</p>
        </Panel>
        <Panel chamfer title="Chamfered" eyebrow="chamfer">
          <p className="u-muted">Cut corners with the hairline redrawn along the cuts. Use sparingly.</p>
        </Panel>
        <Panel chamfer brackets tone="accent" title="Chamfer + brackets" eyebrow="chamfer brackets">
          <p className="u-muted">The hero treatment: one per page at most.</p>
        </Panel>
        <Panel brackets padding="lg" title="Brackets, large padding" eyebrow="brackets padding=lg">
          <p className="u-muted">HUD corner brackets on all four corners.</p>
        </Panel>
      </div>
    </Section>
  )
}

function Forms() {
  const dex = useDex()
  const [text, setText] = useState('Pikachu')
  const [search, setSearch] = useState('')
  const [bad, setBad] = useState('??')
  const [notes, setNotes] = useState('Caught on the first try after a long hunt.')
  const [level, setLevel] = useState<number | null>(25)
  const [date, setDate] = useState(todayIso())
  const [game, setGame] = useState<string | null>('scarlet')
  const [ball, setBall] = useState<number | null>(4)
  const [species, setSpecies] = useState<number | null>(25)
  const [location, setLocation] = useState('')
  const [sw, setSw] = useState(true)
  const [cb, setCb] = useState(true)
  const [cb2, setCb2] = useState(false)
  const [seg, setSeg] = useState<'grid' | 'list' | 'box'>('grid')
  const [gender, setGender] = useState<'m' | 'f' | 'n'>('f')
  const [tab, setTab] = useState<'obtain' | 'forms' | 'entries'>('obtain')
  const shakeRef = useRef<HTMLDivElement>(null)

  const gameOptions = useMemo<SelectOption<string>[]>(() => GAMES.map((g) => ({ value: g.id, label: g.name, icon: <GameIcon game={g} size={22} tooltip={false} alt="" />, description: g.short === g.name ? undefined : String(g.year), group: g.generation === 0 ? 'Services' : `Generation ${g.generation}` })), [])
  const ballOptions = useMemo<SelectOption<number>[]>(() => BALLS.map((b) => ({ value: b.id, label: b.name, icon: <BallIcon ball={b} size={20} label="" /> })), [])
  const speciesOptions = useMemo<SelectOption<number>[]>(() => dex.speciesList.map((s) => ({ value: s.id, label: s.name, keywords: String(s.id), description: dexNo(s.id), icon: <Sprite species={s} size={26} /> })), [dex])
  const locationOptions = useMemo<SelectOption<string>[]>(() => ['South Province (Area One)', 'South Province (Area Two)', 'Poco Path', 'Inlet Grotto', 'Casseroya Lake', 'Area Zero'].map((l) => ({ value: l, label: l, icon: <Icon name="map-pin" size={16} /> })), [])

  return (
    <Section id="forms" title="Form controls">
      <div className="kit-grid kit-grid--2">
        <Panel title="Text inputs">
          <div className="kit-form">
            <TextField label="Nickname" value={text} onChange={setText} placeholder="None" optional hint="Shown on the entry card." />
            <TextField label="Search" value={search} onChange={setSearch} icon="search" placeholder="Name or number" clearable suffix={<Kbd>/</Kbd>} />
            <div ref={shakeRef}>
              <TextField label="With an error" value={bad} onChange={setBad} error={bad.trim().length < 3 ? 'Enter at least 3 characters.' : undefined} suffix={<Button size="sm" variant="ghost" onClick={() => shake(shakeRef.current)}>Shake</Button>} />
            </div>
            <div className="kit-form__pair">
              <TextField label="Small" size="sm" value={text} onChange={setText} />
              <TextField label="Disabled" value="Locked" onChange={() => {}} disabled />
            </div>
            <TextArea label="Notes" value={notes} onChange={setNotes} maxLength={200} optional />
            <div className="kit-form__pair">
              <NumberField label="Level" value={level} onChange={setLevel} min={1} max={100} suffix="Lv." />
              <DateField label="Date caught" value={date} onChange={setDate} max={todayIso()} />
            </div>
          </div>
        </Panel>

        <Panel title="Select and Combobox">
          <div className="kit-form">
            <Select label="Game (grouped, with icons)" options={gameOptions} value={game} onChange={setGame} placeholder="Choose a game" />
            <div className="kit-form__pair">
              <Select label="Ball" options={ballOptions} value={ball} onChange={setBall} />
              <Select label="Small / empty" size="sm" options={ballOptions.slice(0, 5)} value={null} onChange={() => {}} placeholder="Any ball" />
            </div>
            <Combobox label={`Species (${dex.speciesList.length} options, searchable)`} options={speciesOptions} value={species} onChange={setSpecies} placeholder="Search by name or number" />
            <Combobox label="Location (free text with suggestions)" options={locationOptions} value={null} onChange={() => {}} freeText={{ text: location, onTextChange: setLocation }} icon="map-pin" placeholder="Where did you find it?" hint={location ? `Stored as: "${location}"` : 'Pick a suggestion or type anything.'} />
            <Select label="Disabled" options={ballOptions} value={2} onChange={() => {}} disabled />
          </div>
        </Panel>

        <Panel title="Toggles">
          <div className="kit-form">
            <Switch checked={sw} onChange={setSw} label="Regional forms" description="Alolan, Galarian, Hisuian and Paldean forms get their own slot." />
            <Switch checked={!sw} onChange={(v) => setSw(!v)} label="Right-aligned (settings rows)" description="reverse" reverse />
            <Row>
              <Switch checked={sw} onChange={setSw} ariaLabel="Bare switch" />
              <Switch checked={false} onChange={() => {}} ariaLabel="Disabled off" disabled />
              <Switch checked onChange={() => {}} ariaLabel="Disabled on" disabled />
            </Row>
            <Checkbox checked={cb} onChange={setCb} label="Shiny" description="Marks the entry and unlocks the shiny slot." />
            <Checkbox checked={cb2} onChange={setCb2} label="Alpha" />
            <Row>
              <Checkbox checked={cb && cb2} indeterminate={cb !== cb2} onChange={(v) => (setCb(v), setCb2(v))} label="Select all (indeterminate)" />
              <Checkbox checked onChange={() => {}} label="Disabled" disabled />
            </Row>
          </div>
        </Panel>

        <Panel title="SegmentedControl and Tabs">
          <div className="kit-form">
            <Row>
              <SegmentedControl
                label="View"
                value={seg}
                onChange={setSeg}
                options={[
                  { value: 'grid', label: 'Grid', icon: 'grid' },
                  { value: 'list', label: 'List', icon: 'list' },
                  { value: 'box', label: 'Boxes', icon: 'box' }
                ]}
              />
              <SegmentedControl
                label="Gender"
                size="sm"
                value={gender}
                onChange={setGender}
                options={[
                  { value: 'm', icon: <GenderIcon gender="m" size={14} />, ariaLabel: 'Male' },
                  { value: 'f', icon: <GenderIcon gender="f" size={14} />, ariaLabel: 'Female' },
                  { value: 'n', icon: <GenderIcon gender="n" size={14} />, ariaLabel: 'Genderless' }
                ]}
              />
            </Row>
            <SegmentedControl
              label="Preset"
              fill
              value={seg}
              onChange={setSeg}
              options={[
                { value: 'grid', label: 'Species only' },
                { value: 'list', label: 'Forms' },
                { value: 'box', label: 'Completionist' }
              ]}
            />
            <Tabs
              label="Species detail"
              idBase="kit-tabs"
              value={tab}
              onChange={setTab}
              items={[
                { id: 'obtain', label: 'Where to find', icon: 'map-pin' },
                { id: 'forms', label: 'Forms', badge: <Badge count={4} tone="neutral" /> },
                { id: 'entries', label: 'My entries', icon: 'journal', badge: <Badge count={2} /> }
              ]}
            />
            <TabPanel idBase="kit-tabs" id="obtain" value={tab}>
              <p className="u-muted">Arrow keys move between tabs; the underline slides with a transform.</p>
            </TabPanel>
            <TabPanel idBase="kit-tabs" id="forms" value={tab}>
              <p className="u-muted">Forms panel.</p>
            </TabPanel>
            <TabPanel idBase="kit-tabs" id="entries" value={tab}>
              <p className="u-muted">Entries panel.</p>
            </TabPanel>
            <Tabs label="Small tabs" size="sm" value={tab} onChange={setTab} items={[{ id: 'obtain', label: 'All' }, { id: 'forms', label: 'Caught' }, { id: 'entries', label: 'Missing', disabled: true }]} />
          </div>
        </Panel>
      </div>
    </Section>
  )
}

function Overlays() {
  const [dialog, setDialog] = useState<null | 'md' | 'sm' | 'chamfer' | 'long'>(null)
  const [nested, setNested] = useState(false)
  const [drawer, setDrawer] = useState<null | 'right' | 'left'>(null)
  const [density, setDensity] = useState(true)
  return (
    <Section id="overlays" title="Dialog, Drawer, Menu, Tooltip, Toasts">
      <Panel>
        <Row label="Dialog">
          <Button onClick={() => setDialog('md')}>Open dialog</Button>
          <Button onClick={() => setDialog('sm')}>Confirm (small)</Button>
          <Button onClick={() => setDialog('chamfer')}>Chamfered, large</Button>
          <Button onClick={() => setDialog('long')}>Long content</Button>
        </Row>
        <Row label="Drawer">
          <Button onClick={() => setDrawer('right')}>Open right drawer</Button>
          <Button onClick={() => setDrawer('left')}>Open left drawer</Button>
        </Row>
        <Row label="Menu">
          <Menu
            label="Entry actions"
            trigger={
              <Button iconEnd="chevron-down" icon="more">
                Entry actions
              </Button>
            }
            items={[
              { heading: 'Entry' },
              { id: 'edit', label: 'Edit', icon: 'edit', hint: <Kbd>E</Kbd>, onSelect: () => toast({ kind: 'info', title: 'Edit selected' }) },
              { id: 'dup', label: 'Duplicate', icon: 'copy', onSelect: () => toast({ kind: 'success', title: 'Duplicated' }) },
              { id: 'compact', label: 'Compact rows', checked: density, onSelect: () => setDensity(!density) },
              { id: 'locked', label: 'Move to box (soon)', icon: 'box', disabled: true, onSelect: () => {} },
              { separator: true },
              { id: 'del', label: 'Delete', icon: 'trash', danger: true, onSelect: () => toast({ kind: 'error', title: 'Entry deleted', body: 'This is only a demo.' }) }
            ]}
          />
          <Menu label="Sort" align="end" trigger={<IconButton icon="sort" label="Sort" variant="subtle" tooltip={false} />} items={[{ id: 'a', label: 'Dex number', checked: true, onSelect: () => {} }, { id: 'b', label: 'Name', checked: false, onSelect: () => {} }, { id: 'c', label: 'Newest catch', checked: false, onSelect: () => {} }]} />
        </Row>
        <Row label="Tooltip">
          <Tooltip content="Top (default)">
            <Button variant="ghost">Hover or focus me</Button>
          </Tooltip>
          <Tooltip content="On the right" placement="right">
            <Button variant="ghost">Right</Button>
          </Tooltip>
          <Tooltip content="Below, with a longer explanation that wraps onto a second line when it has to." placement="bottom">
            <Button variant="ghost">Bottom, long</Button>
          </Tooltip>
          <Tooltip content="Instant" delay={0} placement="left">
            <Chip tone="accent">No delay</Chip>
          </Tooltip>
        </Row>
        <Row label="Toasts">
          <Button onClick={() => toast({ kind: 'info', title: 'Sprite cache cleared', body: '412 files, 38 MB.' })}>Info</Button>
          <Button onClick={() => toast({ kind: 'success', title: 'Pikachu logged', body: 'Scarlet - South Province (Area One)' })}>Success</Button>
          <Button onClick={() => toast({ kind: 'error', title: 'Your changes could not be saved', body: 'The disk is full. Pelagix will keep trying.' })}>Error</Button>
          <Button variant="primary" icon="medal" onClick={() => toast({ kind: 'achievement', title: 'Kanto Complete', body: 'Catch all 151 Pokémon of the Kanto Pokédex.' })}>
            Achievement
          </Button>
          <Button onClick={() => toast({ kind: 'achievement', title: 'Shiny Hunter', body: 'Log your first shiny.', icon: 'sparkle' })}>Achievement, custom icon</Button>
          <Button variant="ghost" onClick={() => toast({ kind: 'info', title: 'Sticky toast', body: 'durationMs: 0 keeps it until dismissed.', durationMs: 0 })}>
            Sticky
          </Button>
        </Row>
        <Row label="Toasts with an action (F6 jumps to the newest toast and back; the action runs once, then the toast leaves)">
          <Button
            icon="undo"
            onClick={() =>
              toast({
                kind: 'info',
                title: 'Entry deleted',
                body: 'Pikachu · Pokémon Scarlet',
                icon: 'trash',
                action: { label: 'Undo', onSelect: () => toast({ kind: 'success', title: 'Entry restored', icon: 'undo' }) }
              })
            }
          >
            Undo action
          </Button>
          <Button onClick={() => toast({ kind: 'error', title: 'Your changes could not be saved', body: 'The disk is full.', action: { label: 'Try again', onSelect: () => toast({ kind: 'success', title: 'Saved' }) } })}>Error with retry</Button>
          <Button
            icon="medal"
            onClick={() => toast({ kind: 'achievement', title: 'Kanto Complete', body: 'Catch all 151 Pokémon of the Kanto Pokédex.', action: { label: 'View', onSelect: () => toast({ kind: 'info', title: 'Would open Achievements' }) } })}
          >
            Achievement with action
          </Button>
          <Button variant="ghost" onClick={() => toast({ kind: 'success', title: 'Sticky with a long action label', durationMs: 0, action: { label: 'Open the Living Dex', onSelect: () => {} } })}>
            Sticky, long label
          </Button>
        </Row>
      </Panel>

      <Dialog
        open={dialog === 'md'}
        onClose={() => setDialog(null)}
        title="Log a catch"
        description="Focus is trapped here; Escape or the scrim closes it."
        media={<Sprite species={25} size={48} />}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDialog(null)}>
              Cancel
            </Button>
            <Button variant="catch" icon="pokeball" onClick={() => setDialog(null)}>
              Log catch
            </Button>
          </>
        }
      >
        <div className="kit-form">
          <TextField label="Nickname" value="" onChange={() => {}} placeholder="None" data-autofocus />
          <Select label="Ball (popover inside a dialog)" options={BALLS.map((b) => ({ value: b.id, label: b.name, icon: <BallIcon ball={b} size={20} label="" /> }))} value={4} onChange={() => {}} />
          <Button onClick={() => setNested(true)}>Open a dialog on top</Button>
        </div>
      </Dialog>
      <Dialog
        open={nested}
        onClose={() => setNested(false)}
        size="sm"
        title="Stacked dialog"
        description="Escape closes only the top one."
        footer={
          <Button variant="primary" onClick={() => setNested(false)}>
            Done
          </Button>
        }
      />
      <Dialog
        open={dialog === 'sm'}
        onClose={() => setDialog(null)}
        size="sm"
        title="Delete this entry?"
        description="Pikachu, caught in Scarlet on 9 Oct 2026. This cannot be undone."
        dismissable={false}
        hideClose
        footer={
          <>
            <Button variant="ghost" onClick={() => setDialog(null)}>
              Keep it
            </Button>
            <Button variant="danger" icon="trash" onClick={() => setDialog(null)} data-autofocus>
              Delete
            </Button>
          </>
        }
      />
      <Dialog open={dialog === 'chamfer'} onClose={() => setDialog(null)} size="lg" chamfer title="Achievement unlocked" description="A chamfered dialog for the big moments.">
        <EmptyState tone="gold" icon="trophy" title="Kanto Complete" description="All 151 Pokémon of the Kanto Pokédex are in your Living Dex." />
      </Dialog>
      <Dialog
        open={dialog === 'long'}
        onClose={() => setDialog(null)}
        title="Long content scrolls inside"
        footer={
          <Button variant="primary" onClick={() => setDialog(null)}>
            Close
          </Button>
        }
      >
        {Array.from({ length: 24 }, (_, i) => (
          <p key={i} className="u-muted" style={{ marginBottom: 12 }}>
            Paragraph {i + 1}. The header and footer stay put while the body scrolls, and the page behind does not move.
          </p>
        ))}
      </Dialog>
      <Drawer
        open={drawer !== null}
        side={drawer ?? 'right'}
        onClose={() => setDrawer(null)}
        title="Filters"
        description="A modal side panel with the same focus handling as a dialog."
        footer={
          <>
            <Button variant="ghost" onClick={() => setDrawer(null)}>
              Reset
            </Button>
            <Button variant="primary" onClick={() => setDrawer(null)}>
              Apply
            </Button>
          </>
        }
      >
        <div className="kit-form">
          <Row label="Types">
            {TYPE_IDS.slice(0, 18).map((t) => (
              <TypeBadge key={t} type={t} size="sm" />
            ))}
          </Row>
          <Switch checked onChange={() => {}} label="Only uncaught" reverse />
          <Switch checked={false} onChange={() => {}} label="Only shiny-eligible" reverse />
        </div>
      </Drawer>
    </Section>
  )
}

function Bomb({ armed }: { armed: boolean }): ReactNode {
  if (armed) throw new Error('A demo component threw while rendering.')
  return <p className="u-muted">This subtree is healthy.</p>
}

function Feedback() {
  const [value, setValue] = useState(0.42)
  const [count, setCount] = useState(1367)
  const [armed, setArmed] = useState(false)
  return (
    <Section id="feedback" title="Progress, tickers, placeholders">
      <div className="kit-grid kit-grid--2">
        <Panel title="ProgressBar, ProgressRing, NumberTicker" actions={<Button size="sm" onClick={() => (setValue(Math.random()), setCount(Math.round(Math.random() * 1600)))}>Randomise</Button>}>
          <div className="kit-form">
            <ProgressBar value={value} label="Living Dex" />
            <ProgressBar value={value} secondary={Math.min(1, value + 0.2)} tone="gold" size="lg" label="Shiny" />
            <ProgressBar value={1} tone="success" size="sm" label="Complete" />
            <ProgressBar value={value * 0.5} tone="catch" label="Catch" />
            <ProgressBar value={value} color="var(--type-grass)" label="Grass type" />
            <Row>
              <ProgressRing value={value} size={88} label="Completion">
                <span style={{ fontSize: 18 }}>{Math.round(value * 100)}%</span>
              </ProgressRing>
              <ProgressRing value={value} size={56} tone="gold" label="Shiny">
                <ShinyMark size={18} label="" />
              </ProgressRing>
              <ProgressRing value={1} size={56} tone="success" label="Done">
                <Icon name="check" size={20} />
              </ProgressRing>
              <ProgressRing value={value} size={32} tone="catch" label="Small" />
              <div>
                <div className="u-eyebrow">Entries</div>
                <NumberTicker value={count} className="kit-ticker" />
              </div>
              <div>
                <div className="u-eyebrow">Completion</div>
                <NumberTicker value={value * 100} decimals={1} format={(v) => `${v.toFixed(1)}%`} className="kit-ticker" />
              </div>
            </Row>
          </div>
        </Panel>

        <Panel title="Skeleton, Spinner, Kbd, Lens">
          <div className="kit-form">
            <div className="kit-skeleton-card">
              <Skeleton variant="circle" width={56} />
              <div style={{ flex: 1 }}>
                <Skeleton variant="text" width="46%" style={{ fontSize: 18 }} />
                <Skeleton variant="text" width="72%" style={{ marginTop: 10 }} />
                <Skeleton height={8} radius={99} style={{ marginTop: 14 }} />
              </div>
            </div>
            <div className="kit-grid kit-grid--4">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} height={84} radius={14} />
              ))}
            </div>
            <Row>
              <Spinner size={16} />
              <Spinner size={24} />
              <span className="u-muted">Spinner</span>
              <Kbd>Esc</Kbd>
              <Kbd keys={['Ctrl', 'K']} />
              <Kbd keys={['Shift', 'Enter']} />
            </Row>
            <Row>
              <Lens size={28} />
              <Lens size={44} />
              <Lens size={44} busy />
              <Lens size={64} pulse={false} />
              <Leds />
              <span className="u-muted">Lens (idle, busy, static) and LEDs</span>
            </Row>
          </div>
        </Panel>

        <Panel title="EmptyState" padding="none">
          <div className="kit-grid kit-grid--2 kit-empties">
            <EmptyState size="sm" title="No entries yet" description="Log your first catch to see it here." action={<Button variant="catch" size="sm" icon="plus">Log a catch</Button>} />
            <EmptyState size="sm" tone="neutral" icon="search" title="No matches" description="Try a different name or clear the filters." />
            <EmptyState size="sm" tone="gold" icon="trophy" title="Nothing unlocked" description="Achievements appear as your collection grows." />
            <EmptyState size="sm" tone="danger" icon="warning" title="Could not load" description="The species file is missing." action={<Button size="sm" icon="refresh">Retry</Button>} />
          </div>
        </Panel>

        <Panel title="ErrorBoundary" actions={<Button size="sm" variant="danger" onClick={() => setArmed(true)}>Throw</Button>}>
          <ErrorBoundary resetKeys={[armed]} fallback={(error, reset) => <EmptyState size="sm" tone="danger" icon="warning" title="Caught by the boundary" description={error.message} action={<Button size="sm" onClick={() => (setArmed(false), reset())}>Reset</Button>} />}>
            <Bomb armed={armed} />
          </ErrorBoundary>
        </Panel>
      </div>
    </Section>
  )
}

function Icons() {
  return (
    <Section id="icons" title={`Icon (${ICON_NAMES.length})`} note="24 px grid, 1.75 px stroke, currentColor">
      <Panel>
        <div className="kit-icons">
          {ICON_NAMES.map((name) => (
            <div key={name} className="kit-icon">
              <Icon name={name} size={22} />
              <code>{name}</code>
            </div>
          ))}
        </div>
      </Panel>
    </Section>
  )
}

function Pokemon() {
  const dex = useDex()
  const sample = dex.species(25) ?? dex.speciesList[0]
  return (
    <>
      <Section id="sprites" title="Sprite and SpriteStage" note="HOME renders; primary CDN, fallback CDN, placeholder">
        <div className="kit-grid kit-grid--stage">
          <SpriteStage dexNumber={sample?.id ?? 25} glow={typeColor('electric')} className="kit-stage">
            <Sprite species={sample?.id ?? 25} size={220} lazy={false} alt={sample?.name ?? 'Pikachu'} />
          </SpriteStage>
          <Panel>
            <div className="kit-sprites">
              {[
                ['Normal', <Sprite key="a" species={25} size={96} />],
                ['Shiny', <Sprite key="b" species={25} shiny size={96} />],
                ['Female', <Sprite key="c" species={25} female size={96} />],
                ['Silhouette', <Sprite key="d" species={25} silhouette size={96} />],
                ['By path', <Sprite key="e" path="shiny/6.png" size={96} />],
                ['Missing file', <Sprite key="f" path="does-not-exist-000.png" size={96} />],
                ['No source', <Sprite key="g" size={96} />],
                ['Form (Alolan)', <Sprite key="h" species={26} form={1} size={96} />]
              ].map(([label, node]) => (
                <figure key={label as string} className="kit-sprite">
                  <div className="kit-sprite__well">{node}</div>
                  <figcaption>{label}</figcaption>
                </figure>
              ))}
            </div>
            <Row label="Sizes (no layout shift: the box is reserved)">
              {[32, 48, 64, 96, 128].map((s) => (
                <span key={s} className="kit-sprite__well kit-sprite__well--tight">
                  <Sprite species={133} size={s} />
                </span>
              ))}
            </Row>
          </Panel>
        </div>
      </Section>

      <Section id="types" title="TypeBadge" note="19 types, game colours, AA ink on every fill">
        <Panel>
          <Row label="Pill">
            {TYPE_IDS.map((t) => (
              <TypeBadge key={t} type={t} />
            ))}
          </Row>
          <Row label="Pill, small">
            {TYPE_IDS.map((t) => (
              <TypeBadge key={t} type={t} size="sm" />
            ))}
          </Row>
          <Row label="Dot">
            {TYPE_IDS.map((t) => (
              <TypeBadge key={t} type={t} variant="dot" />
            ))}
            <span style={{ width: 16 }} />
            {TYPE_IDS.map((t) => (
              <TypeBadge key={`s-${t}`} type={t} variant="dot" size="sm" />
            ))}
          </Row>
          <Row label="Pairs">
            <TypeBadges types={['grass', 'poison']} />
            <TypeBadges types={['dragon', 'ground']} />
            <TypeBadges types={['fire', 'flying']} size="sm" />
            <TypeBadges types={['water', 'ice']} variant="dot" />
          </Row>
        </Panel>
      </Section>

      <Section id="balls" title={`BallIcon (${BALLS.length})`} note="every PKHeX ball id; inline SVG">
        <Panel>
          <div className="kit-balls">
            {BALLS.map((b) => (
              <div key={b.id} className="kit-ball">
                <div className="kit-ball__sizes">
                  <BallIcon ball={b} size={20} label="" />
                  <BallIcon ball={b} size={24} label="" />
                  <BallIcon ball={b} size={32} label="" />
                  <BallIcon ball={b} size={48} />
                </div>
                <div className="kit-ball__name">{b.name}</div>
                <code>
                  {b.id} - {b.slug}
                </code>
              </div>
            ))}
            <div className="kit-ball">
              <div className="kit-ball__sizes">
                <BallIcon ball={999} size={20} />
                <BallIcon ball={999} size={32} />
              </div>
              <div className="kit-ball__name">Unknown id</div>
              <code>fallback</code>
            </div>
          </div>
        </Panel>
      </Section>

      <Section id="systems" title="SystemIcon" note="one glyph per SystemId">
        <Panel>
          <div className="kit-systems">
            {SYSTEMS.map((s) => (
              <div key={s.id} className="kit-system">
                <div className="kit-system__sizes">
                  <SystemIcon system={s.id} size={16} label="" />
                  <SystemIcon system={s.id} size={20} label="" />
                  <SystemIcon system={s.id} size={32} label="" />
                  <SystemIcon system={s.id} size={56} />
                </div>
                <div className="kit-ball__name">{s.name}</div>
                <code>{s.id}</code>
              </div>
            ))}
          </div>
        </Panel>
      </Section>

      <Section id="games" title={`GameIcon and GameBadge (${GAMES.length})`}>
        <Panel>
          <Row label="All games, 40 px (hover for the name)">
            {GAMES.map((g) => (
              <GameIcon key={g.id} game={g} size={40} />
            ))}
          </Row>
          <Row label="Sizes and fallback tile">
            <GameIcon game="scarlet" size={20} />
            <GameIcon game="scarlet" size={28} />
            <GameIcon game="scarlet" size={48} />
            <GameIcon game="scarlet" size={64} />
            <GameIcon game={{ ...GAMES[0]!, icon: 'missing.png' }} size={48} />
            <GameIcon game={{ ...GAMES[40]!, icon: 'missing.png' }} size={48} />
            <GameIcon game={{ ...GAMES[35]!, icon: 'missing.png' }} size={48} />
            <GameIcon game="unknown-game" size={48} />
          </Row>
          <Row label="GameBadge: the origin of an entry">
            <GameBadge game="scarlet" />
            <GameBadge game="legendsza" />
            <GameBadge game="heartgold" size="sm" />
            <GameBadge game="go" size="sm" />
            <GameBadge game="emerald" compact />
            <GameBadge game="xd" compact size="sm" />
          </Row>
          <Row label="GameBadge, large">
            <GameBadge game="legendsarceus" size="lg" />
            <GameBadge game="crystal" size="lg" />
            <GameBadge game="stadium" size="lg" />
            <GameBadge game="unknown-game" size="lg" />
          </Row>
        </Panel>
      </Section>

      <Section id="marks" title="GenderIcon, ShinyMark, DexNumber, FormCategoryTag">
        <Panel>
          <Row label="Gender">
            <GenderIcon gender="m" />
            <GenderIcon gender="f" />
            <GenderIcon gender="n" />
            <GenderIcon gender="m" size={24} />
            <GenderIcon gender="f" size={24} />
            <GenderIcon gender="n" size={24} />
          </Row>
          <Row label="Shiny">
            <ShinyMark />
            <ShinyMark size={24} />
            <ShinyMark size={32} twinkle />
            <Chip tone="gold" icon={<ShinyMark size={12} label="" />}>
              Shiny
            </Chip>
          </Row>
          <Row label="Dex number">
            <DexNumber id={25} />
            <DexNumber id={1025} />
            <DexNumber id={6} variant="plain" />
            <div className="kit-watermark">
              <DexNumber id={25} variant="watermark" />
            </div>
          </Row>
          <Row label="Form categories">
            {FORM_CATS.map((c) => (
              <FormCategoryTag key={c} cat={c} />
            ))}
            <FormCategoryTag cat="regional" region="alola" />
            <FormCategoryTag cat="regional" region="hisui" />
          </Row>
        </Panel>
      </Section>
    </>
  )
}

// ---------------------------------------------------------------- entries

interface EntrySample {
  label: string
  entry: CatchEntry
}

const SAMPLE_PREFIX = 'kit-sample-'

function sampleEntry(label: string, key: string, species: number, form: number, rest: Partial<CatchEntry> & Pick<CatchEntry, 'game' | 'kind'>, order: number): EntrySample {
  const stamp = new Date(Date.UTC(2026, 9, 1, 9, order)).toISOString()
  return { label, entry: { id: `${SAMPLE_PREFIX}${key}`, species, form, shiny: false, createdAt: stamp, updatedAt: stamp, ...rest } }
}

const LONG_NOTES =
  'Took most of a weekend. The outbreak kept despawning whenever the picnic table clipped into the hillside, so I ended up resetting the day four times before the sixtieth knock-out.\n' +
  'Keeping this one for the ribbon run: needs Jolly Mint, Tera Fighting and the Master Rank ribbon before it goes into the Living Dex box for good.'

const ENTRY_SAMPLES: readonly EntrySample[] = [
  sampleEntry('Shiny, female render, everything filled in', 'pikachu', 25, 0, { gender: 'f', shiny: true, game: 'scarlet', kind: 'wild', method: 'Tall grass', location: 'South Province (Area One)', ball: 15, level: 12, date: '2026-10-09', nickname: 'Sparky', ot: 'Hydro', notes: 'Full odds, third encounter of the day.' }, 1),
  sampleEntry('Regional form, evolved from', 'raichu', 26, 1, { gender: 'm', game: 'ultrasun', kind: 'evolved', method: 'Use Thunder Stone', origin: [25, 0], location: 'Hau’oli City', ball: 26, level: 37, date: '2026-03-14' }, 2),
  sampleEntry('Variant (Alcremie sweet)', 'alcremie', 869, 1, { variant: 3, gender: 'f', game: 'shield', kind: 'evolved', method: 'Spin while holding a Star Sweet', origin: [868, 0], ball: 25, level: 30, date: '2025-12-24', ot: 'Hydro' }, 3),
  sampleEntry('Gigantamax, shiny', 'charizard', 6, 0, { gmax: true, shiny: true, gender: 'm', game: 'sword', kind: 'raid', method: 'Max Raid Battle', location: 'Lake of Outrage', ball: 2, level: 60, date: '2024-06-02', ot: 'Hydro' }, 4),
  sampleEntry('Alpha, Hisuian ball', 'arcanine', 59, 1, { alpha: true, gender: 'f', game: 'legendsarceus', kind: 'static', method: 'Alpha', location: 'Firespit Island', ball: 36, level: 85, date: '2023-02-11' }, 5),
  sampleEntry('Unknown game id', 'mewtwo', 150, 0, { gender: 'n', game: 'pokemon-champions', kind: 'transfer', ball: 1, level: 70, date: '2026-08-30' }, 6),
  sampleEntry('Minimal fields', 'ditto', 132, 0, { game: 'red', kind: 'other' }, 7),
  sampleEntry('Long name, nickname, location and notes', 'tauros', 128, 2, { gender: 'm', game: 'scarlet', kind: 'outbreak', method: 'Mass Outbreak', location: 'East Province (Area Two), on the cliffs north of the Pokémon League gate', ball: 20, level: 100, date: '2026-01-18', nickname: 'Sir Charges-a-Lot III', ot: 'Maximilian', notes: LONG_NOTES }, 8),
  sampleEntry('No location (gift)', 'eevee', 133, 0, { gender: 'm', game: 'heartgold', kind: 'gift', ball: 4, level: 5, date: '2022-07-04', nickname: 'Bean' }, 9),
  sampleEntry('Mobile game, event', 'mew', 151, 0, { gender: 'n', game: 'go', kind: 'event', method: 'Special Research', ball: 4, level: 15, notes: 'A Mythical Discovery.' }, 10),
  sampleEntry('Pokémon the data does not know', 'unknown', 1400, 0, { game: 'legendsza', kind: 'wild', location: 'Wild Zone 20', ball: 3 }, 11)
]

const ROW_WIDTHS = [
  { value: 0, label: 'Full' },
  { value: 760, label: '760' },
  { value: 620, label: '620' },
  { value: 500, label: '500' },
  { value: 380, label: '380' }
]

function Entries() {
  const dex = useDex()
  const saved = useEntries()
  const editor = useUiStore((s) => s.entryEditor)
  const [rowWidth, setRowWidth] = useState(0)
  const [highlighted, setHighlighted] = useState(false)

  const savedById = useMemo(() => new Map(saved.map((e) => [e.id, e])), [saved])
  const inSave = ENTRY_SAMPLES.filter((s) => savedById.has(s.entry.id)).length
  // Once a sample is in the save the gallery shows the saved entry, so its menu acts on something real.
  const samples = useMemo(() => ENTRY_SAMPLES.map((s) => ({ label: s.label, entry: savedById.get(s.entry.id) ?? s.entry, live: savedById.has(s.entry.id) })), [savedById])
  const pick = (key: string) => samples.find((s) => s.entry.id === `${SAMPLE_PREFIX}${key}`) ?? samples[0]!
  const target = samples.find((s) => s.live)
  const opened = (entry: CatchEntry): void => void toast({ kind: 'info', title: 'onOpen', body: entrySummary(dex, entry) })

  const addSamples = (): void => {
    const { added } = useSaveStore.getState().mergeEntries(ENTRY_SAMPLES.map((s) => s.entry))
    toast({ kind: 'success', title: `${plural(added, 'sample entry', 'sample entries')} added to this save` })
  }
  const removeSamples = (): void => {
    const store = useSaveStore.getState()
    const removed = ENTRY_SAMPLES.filter((s) => store.deleteEntry(s.entry.id) !== null).length
    toast({ kind: 'info', title: `${plural(removed, 'sample entry', 'sample entries')} removed` })
  }

  return (
    <Section id="entries" title="EntryCard and entry actions" note="components/pokemon/EntryCard.tsx, lib/entry-actions.ts - the one way a logged entry is shown and acted on">
      <Panel
        title="Sample entries"
        eyebrow={inSave > 0 ? `${inSave} of ${ENTRY_SAMPLES.length} in this save: their menus are live` : 'Not in the save: shown without menus'}
        actions={
          <>
            <Button variant="primary" size="sm" icon="plus" onClick={addSamples} disabled={inSave === ENTRY_SAMPLES.length}>
              Add samples to the save
            </Button>
            <Button size="sm" icon="trash" onClick={removeSamples} disabled={inSave === 0}>
              Remove samples
            </Button>
          </>
        }
      >
        <Row label={target ? `Entry actions, fired at: ${entrySummary(dex, target.entry)}` : 'Entry actions (add the samples first)'}>
          <Button icon="edit" disabled={!target} onClick={() => target && editEntry(target.entry.id)}>
            editEntry
          </Button>
          <Button icon="copy" disabled={!target} onClick={() => target && duplicateEntryWithToast(target.entry.id)}>
            duplicateEntryWithToast
          </Button>
          <Button icon="trash" variant="danger" disabled={!target} onClick={() => target && deleteEntryWithUndo(target.entry.id)}>
            deleteEntryWithUndo
          </Button>
          <Button icon="dex" variant="ghost" disabled={!target} onClick={() => target && openEntrySpecies(target.entry)}>
            openEntrySpecies
          </Button>
          <Button variant="ghost" onClick={() => editEntry('no-such-entry')}>
            editEntry (missing id)
          </Button>
        </Row>
        <Row label="Entry editor state (store/ui)">
          <code>{editor.open ? (editor.mode === 'edit' ? `edit ${editor.entryId}` : `create #${editor.preset.species}`) : 'closed'}</code>
          <Button size="sm" variant="ghost" disabled={!editor.open} onClick={() => useUiStore.getState().closeEditor()}>
            closeEditor
          </Button>
          <span className="u-muted kit-note">Entries in this save: {saved.length}</span>
        </Row>
      </Panel>

      <div className="kit-subhead u-eyebrow">variant="card" - grids and the Pokémon page (min column {ENTRY_CARD_METRICS.cardMinWidth} px)</div>
      <div className="kit-entries">
        {samples.map((s) => (
          <div key={s.entry.id} className="kit-entry">
            <div className="kit-entry__label u-muted">{s.label}</div>
            <EntryCard entry={s.entry} actions={s.live} />
          </div>
        ))}
      </div>

      <div className="kit-subhead u-eyebrow">card: onOpen (click, Enter, Space), highlight, showSpecies=false</div>
      <div className="kit-entries">
        <div className="kit-entry">
          <div className="kit-entry__label u-muted">onOpen: the whole card is one target, the menu stays separate</div>
          <EntryCard entry={pick('raichu').entry} actions={pick('raichu').live} onOpen={opened} />
        </div>
        <div className="kit-entry">
          <div className="kit-entry__label kit-entry__label--action u-muted">
            highlight
            <Button size="sm" variant="ghost" onClick={() => setHighlighted(!highlighted)}>
              {highlighted ? 'Turn off' : 'Turn on (pops in once)'}
            </Button>
          </div>
          <EntryCard entry={pick('arcanine').entry} actions={pick('arcanine').live} highlight={highlighted} onOpen={opened} />
        </div>
        <div className="kit-entry">
          <div className="kit-entry__label u-muted">showSpecies=false: the game leads, the form still shows</div>
          <EntryCard entry={pick('alcremie').entry} actions={pick('alcremie').live} showSpecies={false} />
        </div>
        <div className="kit-entry">
          <div className="kit-entry__label u-muted">showSpecies=false, base form, shiny</div>
          <EntryCard entry={pick('pikachu').entry} actions={pick('pikachu').live} showSpecies={false} />
        </div>
      </div>

      <div className="kit-subhead kit-subhead--controls">
        <span className="u-eyebrow">variant="row" - {ENTRY_CARD_METRICS.rowHeight} px, columns align across rows and collapse with the container</span>
        <SegmentedControl label="Container width" size="sm" value={rowWidth} onChange={setRowWidth} options={ROW_WIDTHS} />
      </div>
      <div className="kit-entry-rows" style={{ maxWidth: rowWidth === 0 ? undefined : rowWidth }}>
        <EntryRowHeader actions={inSave > 0} />
        {samples.map((s) => (
          // A sample that was deleted from the save has no menu; the class keeps its columns in line with the others.
          <EntryCard key={s.entry.id} variant="row" entry={s.entry} actions={s.live} className={inSave > 0 && !s.live ? 'has-actions' : undefined} onOpen={opened} highlight={highlighted && s.entry.id.endsWith('arcanine')} />
        ))}
      </div>

      <div className="kit-subhead u-eyebrow">row, showSpecies=false, no menu, not activatable</div>
      <div className="kit-entry-rows" style={{ maxWidth: rowWidth === 0 ? undefined : rowWidth }}>
        <EntryRowHeader showSpecies={false} actions={false} />
        {samples.slice(0, 5).map((s) => (
          <EntryCard key={s.entry.id} variant="row" entry={s.entry} showSpecies={false} actions={false} />
        ))}
      </div>

      <div className="kit-subhead u-eyebrow">variant="compact" - {ENTRY_CARD_METRICS.compactHeight} px, for drawers, tooltips and the dashboard</div>
      <div className="kit-grid kit-grid--3">
        <Panel title="Recent catches" padding="sm">
          <div className="kit-entry-compacts">
            {samples.slice(0, 6).map((s) => (
              <EntryCard key={s.entry.id} variant="compact" entry={s.entry} onOpen={opened} highlight={highlighted && s.entry.id.endsWith('arcanine')} />
            ))}
          </div>
        </Panel>
        <Panel title="showSpecies=false" padding="sm">
          <div className="kit-entry-compacts">
            {samples.slice(0, 6).map((s) => (
              <EntryCard key={s.entry.id} variant="compact" entry={s.entry} showSpecies={false} />
            ))}
          </div>
        </Panel>
        <Panel title="Narrow (220 px) and inside a tooltip" padding="sm">
          <div className="kit-entry-compacts" style={{ width: 220 }}>
            {samples.slice(6, 9).map((s) => (
              <EntryCard key={s.entry.id} variant="compact" entry={s.entry} onOpen={opened} />
            ))}
          </div>
          <Row>
            <Tooltip content={<EntryCard variant="compact" entry={pick('charizard').entry} />} placement="top">
              <Button size="sm" variant="ghost">
                Hover: compact in a tooltip
              </Button>
            </Tooltip>
          </Row>
        </Panel>
      </div>

      <div className="kit-subhead u-eyebrow">card at narrow widths (240 px and 200 px): text truncates, nothing overflows</div>
      <div className="kit-row__items" style={{ alignItems: 'stretch', flexWrap: 'wrap' }}>
        <div style={{ width: 240, display: 'flex' }}>
          <EntryCard entry={pick('tauros').entry} actions={pick('tauros').live} className="kit-entry-fill" />
        </div>
        <div style={{ width: 200, display: 'flex' }}>
          <EntryCard entry={pick('charizard').entry} actions={pick('charizard').live} className="kit-entry-fill" />
        </div>
        <div style={{ width: 240, display: 'flex' }}>
          <EntryCard entry={pick('mewtwo').entry} actions={pick('mewtwo').live} showSpecies={false} className="kit-entry-fill" />
        </div>
      </div>
    </Section>
  )
}

function Motion() {
  const tilesRef = useRef<HTMLDivElement>(null)
  const targetRef = useRef<HTMLDivElement>(null)
  const burstRef = useRef<HTMLDivElement>(null)
  const countRef = useRef<HTMLSpanElement>(null)
  const scopeRoot = useRef<HTMLDivElement>(null)
  const settings = useSettings()

  // useAnimeScope: a looping wave, reverted on unmount and rebuilt when the motion setting flips.
  const scope = useAnimeScope(scopeRoot, (self, { motion }) => {
    if (motion) animate('.kit-scope__bar', { scaleY: [0.35, 1], duration: 620, delay: stagger(70), loop: true, alternate: true, ease: 'inOut(2)' })
    self.add('kick', () => {
      if (motion) animate('.kit-scope__bar', { y: [-10, 0], duration: 420, delay: stagger(30), ease: 'outBack(2)' })
    })
  })

  const tiles = (): Element[] => Array.from(tilesRef.current?.children ?? [])
  return (
    <Section id="motion" title="Motion helpers" note="lib/anim.ts - all respect the reduce-motion setting and the OS preference">
      <div className="kit-grid kit-grid--2">
        <Panel
          title="enterStagger / pageEnter"
          actions={
            <>
              <Button size="sm" onClick={() => enterStagger(tiles())}>
                enterStagger
              </Button>
              <Button size="sm" onClick={() => enterStagger(tiles(), { from: 'center', step: 40 })}>
                from centre
              </Button>
              <Button size="sm" onClick={() => pageEnter(tilesRef.current)}>
                pageEnter
              </Button>
            </>
          }
        >
          <div ref={tilesRef} className="kit-tiles">
            {[1, 4, 7, 25, 133, 150, 201, 479, 493, 646, 666, 869].map((id) => (
              <div key={id} className="kit-tile">
                <Sprite species={id} size={56} />
              </div>
            ))}
          </div>
        </Panel>

        <Panel
          title="popIn / pulse / flipIn / shake"
          actions={
            <>
              <Button size="sm" onClick={() => popIn(targetRef.current)}>
                popIn
              </Button>
              <Button size="sm" onClick={() => pulse(targetRef.current)}>
                pulse
              </Button>
              <Button size="sm" onClick={() => flipIn(targetRef.current)}>
                flipIn
              </Button>
              <Button size="sm" onClick={() => shake(targetRef.current)}>
                shake
              </Button>
            </>
          }
        >
          <div className="kit-motion-stage">
            <div ref={targetRef} className="kit-motion-target">
              <BallIcon ball={1} size={56} />
            </div>
          </div>
        </Panel>

        <Panel
          title="burst / countUp"
          actions={
            <>
              <Button size="sm" variant="primary" icon="sparkle" onClick={() => burst(burstRef.current)}>
                burst
              </Button>
              <Button size="sm" onClick={() => burst(burstRef.current, { colors: ['var(--catch)', 'var(--ball-white)', 'var(--accent-2)'], count: 26, distance: 110 })}>
                custom
              </Button>
              <Button size="sm" onClick={() => countUp(countRef.current, Math.round(Math.random() * 1500))}>
                countUp
              </Button>
            </>
          }
        >
          <div className="kit-motion-stage">
            <div ref={burstRef} className="kit-motion-target kit-motion-target--burst">
              <Sprite species={25} shiny size={84} />
            </div>
            <span ref={countRef} className="kit-ticker">
              0
            </span>
          </div>
        </Panel>

        <Panel
          title="useAnimeScope"
          actions={
            <Button size="sm" onClick={() => scope.current?.methods.kick?.()}>
              scope.methods.kick()
            </Button>
          }
        >
          <div ref={scopeRoot} className="kit-scope">
            {Array.from({ length: 14 }, (_, i) => (
              <span key={i} className="kit-scope__bar" />
            ))}
          </div>
          <p className="u-muted kit-note">Reduce motion is {settings.reduceMotion ? 'ON: nothing above moves, entrances become a 120 ms fade' : 'off'}.</p>
        </Panel>
      </div>
    </Section>
  )
}

function Virtual() {
  const dex = useDex()
  const gridRef = useRef<VirtualGridHandle>(null)
  const [jump, setJump] = useState<number | null>(151)
  const [dense, setDense] = useState(false)
  const [picked, setPicked] = useState<string>('nothing yet')
  // The fixture is small; repeat it so the windowing is visible either way.
  const items = useMemo(() => (dex.speciesList.length >= 400 ? dex.speciesList : Array.from({ length: 40 }, () => dex.speciesList).flat()), [dex])
  return (
    <Section id="virtual" title={`VirtualGrid (${items.length} items)`} note="only visible rows are mounted; one tab stop, arrow keys move between cells">
      <Panel
        padding="none"
        title="scroll=&quot;self&quot;"
        actions={
          <>
            <span className="u-muted kit-note">Activated: {picked}</span>
            <Switch checked={dense} onChange={setDense} label="Dense" />
            <div style={{ width: 110 }}>
              <NumberField value={jump} onChange={setJump} min={1} max={items.length} size="sm" steppers={false} aria-label="Item number" />
            </div>
            <Button size="sm" onClick={() => jump !== null && gridRef.current?.focusIndex(jump - 1)}>
              Focus item
            </Button>
            <Button size="sm" onClick={() => jump !== null && gridRef.current?.scrollToIndex(jump - 1, { align: 'center', behavior: 'smooth' })}>
              Scroll to
            </Button>
          </>
        }
      >
        <div className="kit-virtual">
          <VirtualGrid
            ref={gridRef}
            scroll="self"
            label="All species"
            items={items}
            itemKey={(s, i) => `${s.id}-${i}`}
            minColumnWidth={dense ? 84 : 124}
            itemHeight={dense ? 96 : 132}
            gap={dense ? 8 : 12}
            cellClassName="kit-cell"
            onActivate={(s) => setPicked(`${dexNo(s.id)} ${s.name}`)}
            renderItem={(s) => (
              <>
                <Sprite species={s} size={dense ? 52 : 72} />
                <span className="kit-cell__name u-truncate">{s.name}</span>
                {!dense && <DexNumber id={s.id} variant="plain" />}
              </>
            )}
          />
        </div>
      </Panel>
    </Section>
  )
}

function VirtualPage() {
  const dex = useDex()
  const [picked, setPicked] = useState('nothing yet')
  const items = useMemo(() => (dex.speciesList.length >= 400 ? dex.speciesList : Array.from({ length: 40 }, () => dex.speciesList).flat()), [dex])
  return (
    <Section id="virtual-page" title="VirtualGrid, scroll=&quot;page&quot;" note={`virtualised against the app's main region - the default for full pages. Activated: ${picked}`}>
      <VirtualGrid
        label="All species, page scroll"
        items={items}
        itemKey={(s, i) => `${s.id}-${i}`}
        minColumnWidth={104}
        itemHeight={(w) => Math.round(w * 0.92)}
        gap={10}
        cellClassName="kit-cell"
        onActivate={(s) => setPicked(`${dexNo(s.id)} ${s.name}`)}
        renderItem={(s) => (
          <>
            <Sprite species={s} size={56} />
            <span className="kit-cell__name u-truncate">{s.name}</span>
          </>
        )}
      />
    </Section>
  )
}

function Screens() {
  const [which, setWhich] = useState<'loading' | 'data' | 'save'>('loading')
  return (
    <Section id="screens" title="Start-up screens" note="shell/BootScreen.tsx">
      <Row>
        <SegmentedControl
          label="Screen"
          value={which}
          onChange={setWhich}
          options={[
            { value: 'loading', label: 'Loading' },
            { value: 'data', label: 'Datasets missing' },
            { value: 'save', label: 'Save failed' }
          ]}
        />
      </Row>
      <div className="kit-screen">
        {which === 'loading' && (
          <BootScreen
            steps={[
              { label: 'Loading your save', state: 'done' },
              { label: 'Surfacing Pokédex data', state: 'active' }
            ]}
          />
        )}
        {which === 'data' && (
          <BootError
            title="The Pokédex datasets are missing"
            hint={
              <>
                Run <code>npm run data</code> to build the datasets, then try again.
              </>
            }
            detail="Could not load the Pokédex dataset ./data/dex.json: Failed to fetch."
            onRetry={() => {}}
          />
        )}
        {which === 'save' && <BootError title="Your save could not be loaded" hint="Nothing has been overwritten. Make sure the save file is readable, then try again." detail="Your save could not be loaded: EACCES: permission denied, open 'save.json'" onRetry={() => {}} />}
      </div>
    </Section>
  )
}

const NAV: Array<[string, string]> = [
  ['colour', 'Colour'],
  ['type', 'Type'],
  ['buttons', 'Buttons'],
  ['chips', 'Chips'],
  ['panels', 'Panels'],
  ['forms', 'Forms'],
  ['overlays', 'Overlays'],
  ['feedback', 'Feedback'],
  ['icons', 'Icons'],
  ['sprites', 'Sprites'],
  ['types', 'Types'],
  ['balls', 'Balls'],
  ['systems', 'Systems'],
  ['games', 'Games'],
  ['marks', 'Marks'],
  ['entries', 'Entries'],
  ['motion', 'Motion'],
  ['virtual', 'VirtualGrid'],
  ['screens', 'Screens'],
  ['updates', 'Updates'],
  ['virtual-page', 'Page grid']
]

export default function KitPage() {
  const settings = useSettings()
  const setSettings = useSaveStore((s) => s.setSettings)
  return (
    <div className="page kit">
      <header className="page-header">
        <div>
          <div className="u-eyebrow">Development only</div>
          <h1 className="page-title">Component kit</h1>
          <p className="page-subtitle">Every shared component and motion helper, in both themes. Feature pages are built from these.</p>
        </div>
        <div className="kit-controls">
          <SegmentedControl
            label="Theme"
            value={settings.theme}
            onChange={(theme) => setSettings({ theme })}
            options={[
              { value: 'dark', label: 'Dark', icon: 'moon' },
              { value: 'light', label: 'Light', icon: 'sun' }
            ]}
          />
          <Switch checked={settings.reduceMotion} onChange={(reduceMotion) => setSettings({ reduceMotion })} label="Reduce motion" />
        </div>
      </header>

      <nav className="kit-nav" aria-label="Kit sections">
        {NAV.map(([id, label]) => (
          <Chip key={id} size="sm" onClick={() => document.getElementById(`kit-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
            {label}
          </Chip>
        ))}
      </nav>

      <div className="kit-hud">
        <HudBrackets />
        <Lens size={40} />
        <div>
          <div className="u-eyebrow">Abyss design language</div>
          <div className="u-muted">Deep navy, glass surfaces, azure-to-ice accent, catch red, shiny gold. Hardware cues with restraint.</div>
        </div>
        <Leds />
      </div>

      <Foundations />
      <Buttons />
      <ChipsAndBadges />
      <Panels />
      <Forms />
      <Overlays />
      <Feedback />
      <Icons />
      <Pokemon />
      <Entries />
      <Motion />
      <Virtual />
      <Screens />
      <UpdatesKit />
      <VirtualPage />
    </div>
  )
}
