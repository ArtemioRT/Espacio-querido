import { cx } from '@/utils/format';
import styles from './SectionArcs.module.scss';

interface Props {
  /** top: arcos ∪ colgando desde el borde superior · bottom: arcos ∩ subiendo desde el borde inferior */
  edge: 'top' | 'bottom';
  side?: 'left' | 'right' | 'center';
  /** light = líneas claras (sobre fondo guinda) · dark = líneas guinda (sobre fondo claro) */
  tone?: 'light' | 'dark';
}

/**
 * Arcos concéntricos del sitio original. Colocando uno con edge="bottom" al final de una sección
 * y otro con edge="top" (mismo lado) al inicio de la siguiente se forma un círculo que "cruza"
 * de una sección a otra.
 */
export default function SectionArcs({ edge, side = 'left', tone = 'dark' }: Props) {
  return <span aria-hidden="true" className={cx(styles.arcs, styles[edge], styles[side], styles[tone])} />;
}
