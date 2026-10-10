import { useMemo } from 'react'
import type { FamilyNode } from '@shared/dex-types'
import { Sprite } from '@renderer/components/pokemon'
import { cx, Icon } from '@renderer/components/ui'
import { useT } from '@renderer/i18n'
import { evolutionText, formFullName, speciesName } from '@renderer/i18n/terms'
import type { Dex } from '@renderer/lib/data'
import { buildFamilyTree, familyHasEvolutions, type FamilyBranch } from './sources'

export interface FamilyTreeProps {
  dex: Dex
  family: readonly FamilyNode[]
  /** The Pokémon and form the page is showing. */
  current: { species: number; form: number }
  shiny: boolean
  onOpen: (species: number, form: number) => void
}

interface BranchProps extends Omit<FamilyTreeProps, 'family'> {
  branch: FamilyBranch
  /** The shown form is not a stage of its own (a cap Pikachu, a Mega): its species stands in for it. */
  anyForm: boolean
}

function Branch({ branch, dex, current, shiny, onOpen, anyForm }: BranchProps) {
  const t = useT()
  const { node, alsoForms, children } = branch
  const species = dex.species(node.s)
  const form = dex.form(node.s, node.f)
  const folded = alsoForms.length > 0
  const isCurrent = node.s === current.species && (anyForm || node.f === current.form || (folded && alsoForms.includes(current.form)))
  const name = !species ? `#${node.s}` : folded || !form ? speciesName(species) : formFullName(species, form)
  // Many leaf branches (Eevee) read better as a grid than as one tall column.
  const wide = children.length > 4 && children.every((child) => child.children.length === 0)

  return (
    <div className="sp-fam__branch">
      <button
        type="button"
        className={cx('sp-fam__node', isCurrent && 'is-current')}
        aria-current={isCurrent ? 'true' : undefined}
        aria-label={isCurrent ? t('species.family.current', { name }) : t('species.family.open', { name })}
        onClick={() => !isCurrent && onOpen(node.s, node.f)}
      >
        <Sprite species={node.s} form={node.f} shiny={shiny} size={52} />
        <span className="sp-fam__name">{name}</span>
        {folded && <span className="sp-fam__more">{t('species.family.forms', { count: alsoForms.length + 1 })}</span>}
      </button>
      {children.length > 0 && (
        <ul className={cx('sp-fam__kids', wide && 'sp-fam__kids--wide')}>
          {children.map((child) => (
            <li key={`${child.node.s}-${child.node.f}`} className="sp-fam__kid">
              <span className="sp-fam__how">
                <Icon name="arrow-right" size={14} className="sp-fam__arrow" />
                <span>{child.node.how !== undefined ? evolutionText(child.node.how) : t('species.family.evolves')}</span>
              </span>
              <Branch branch={child} dex={dex} current={current} shiny={shiny} onOpen={onOpen} anyForm={anyForm} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** The evolution family as renders with the "how" between stages; branches and regional lines included. */
export function FamilyTree({ dex, family, current, shiny, onOpen }: FamilyTreeProps) {
  const t = useT()
  const tree = useMemo(() => buildFamilyTree(family, current), [family, current])
  const anyForm = !family.some((node) => node.s === current.species && node.f === current.form)
  if (!familyHasEvolutions(tree)) return <p className="sp-fam__alone">{t('species.family.alone')}</p>
  return (
    <div className="sp-fam">
      {tree.map((root) => (
        <Branch key={`${root.node.s}-${root.node.f}`} branch={root} dex={dex} current={current} shiny={shiny} onOpen={onOpen} anyForm={anyForm} />
      ))}
    </div>
  )
}
