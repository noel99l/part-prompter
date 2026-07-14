import Link from 'next/link'
import styles from './BrandLogo.module.css'

type BrandLogoProps = {
  href?: string
  size?: 'compact' | 'regular' | 'large'
  className?: string
  ariaLabel?: string
}

export default function BrandLogo({
  href = '/',
  size = 'regular',
  className,
  ariaLabel = 'PART-PROMPTER トップ',
}: BrandLogoProps) {
  const classes = [styles.logo, styles[size], className].filter(Boolean).join(' ')

  return (
    <Link href={href} className={classes} aria-label={ariaLabel}>
      PART<span className={styles.accent}>-</span>PROMPTER
    </Link>
  )
}
