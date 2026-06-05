import { Tooltip } from '@base-ui/react/tooltip'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import styles from './Dashboard.module.css'

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string
  children: ReactNode
  variant?: 'default' | 'primary' | 'danger'
}

export function IconButton({
  label,
  children,
  className,
  variant = 'default',
  ...props
}: IconButtonProps) {
  const variantClass = variant === 'primary' ? styles.iconButtonPrimary : variant === 'danger' ? styles.iconButtonDanger : ''

  return (
    <Tooltip.Root>
      <Tooltip.Trigger
        className={[styles.iconButton, variantClass, className].filter(Boolean).join(' ')}
        aria-label={label}
        title={undefined}
        {...props}
      >
        {children}
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Positioner sideOffset={8}>
          <Tooltip.Popup className={styles.tooltip}>
            <Tooltip.Arrow className={styles.tooltipArrow} />
            {label}
          </Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  )
}
