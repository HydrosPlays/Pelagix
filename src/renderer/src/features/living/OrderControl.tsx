import { SegmentedControl, Tooltip } from '@renderer/components/ui'
import type { DexOrder } from '@renderer/domain/debut'
import { useT } from '@renderer/i18n'

export interface OrderControlProps {
  value: DexOrder
  onChange: (order: DexOrder) => void
  /** A game is chosen: its own Pokédex order wins, so the switch is shown but cannot be used. */
  unavailable: boolean
}

/** National Dex or debut-generation order, for the Living Dex and the HOME Dex toolbars. */
export function OrderControl({ value, onChange, unavailable }: OrderControlProps) {
  const t = useT()
  return (
    <Tooltip content={t('living.toolbar.order.unavailable')} disabled={!unavailable} placement="bottom">
      <SegmentedControl
        className="living-order"
        label={t('living.toolbar.order')}
        value={value}
        onChange={onChange}
        disabled={unavailable}
        options={[
          { value: 'national', label: t('living.toolbar.order.national') },
          { value: 'debut', label: t('living.toolbar.order.debut') }
        ]}
      />
    </Tooltip>
  )
}
