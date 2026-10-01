import {
  ArrowDown,
  ArrowUp,
  BadgeAlert,
  Blend,
  Braces,
  Bug,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  CircleAlert,
  CircleCheck,
  CircleHelp,
  Code,
  Copy,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  FileCog,
  ImageOff,
  Info,
  Keyboard,
  List,
  ListTree,
  LocateFixed,
  Lock,
  LogOut,
  type LucideIcon,
  type LucideProps,
  Minus,
  Move,
  Palette,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Plus,
  Pointer,
  RefreshCw,
  Save,
  Scan,
  Search,
  Server,
  Settings,
  SlidersHorizontal,
  Spline,
  TextSearch,
  Trash2,
  TriangleAlert,
  Undo2,
  User,
  UserCog,
  WifiOff,
  X,
} from 'lucide-react'
import * as React from 'react'

import { cn } from '../../lib/utils'

/**
 * Icon names keep the Material Symbols identifiers used by the Slim v2
 * design, so call sites read the same as the design spec.
 */
const ICONS = {
  account_tree: ListTree,
  add: Plus,
  arrow_downward: ArrowDown,
  arrow_upward: ArrowUp,
  bug_report: Bug,
  check: Check,
  check_circle: CircleCheck,
  chevron_left: ChevronLeft,
  chevron_right: ChevronRight,
  close: X,
  code: Code,
  content_copy: Copy,
  data_object: Braces,
  delete: Trash2,
  dns: Server,
  download: Download,
  error: CircleAlert,
  expand_less: ChevronUp,
  expand_more: ChevronDown,
  fit_screen: Scan,
  format_list_bulleted: List,
  gradient: Blend,
  help: CircleHelp,
  hide_image: ImageOff,
  info: Info,
  keyboard: Keyboard,
  left_panel_close: PanelLeftClose,
  left_panel_open: PanelLeftOpen,
  lock: Lock,
  logout: LogOut,
  manage_accounts: UserCog,
  manage_search: TextSearch,
  my_location: LocateFixed,
  new_releases: BadgeAlert,
  open_in_new: ExternalLink,
  open_with: Move,
  palette: Palette,
  person: User,
  polyline: Spline,
  refresh: RefreshCw,
  remove: Minus,
  right_panel_close: PanelRightClose,
  right_panel_open: PanelRightOpen,
  save: Save,
  search: Search,
  settings: Settings,
  settings_applications: FileCog,
  touch_app: Pointer,
  tune: SlidersHorizontal,
  undo: Undo2,
  visibility: Eye,
  visibility_off: EyeOff,
  warning: TriangleAlert,
  wifi_off: WifiOff,
} satisfies Record<string, LucideIcon>

export type IconName = keyof typeof ICONS

export function isIconName(value: string): value is IconName {
  return Object.hasOwn(ICONS, value)
}

export interface IconProps extends Omit<LucideProps, 'ref' | 'size' | 'name'> {
  name: IconName
  /** Rendered width and height in px */
  size?: number
  /** Tint the glyph's closed shapes; inner strokes stay visible */
  filled?: boolean
}

/** Decorative SVG icon; give the surrounding control its accessible name. */
export const Icon = React.forwardRef<SVGSVGElement, IconProps>(
  ({ name, size = 20, filled = false, className, ...props }, ref) => {
    const Glyph = ICONS[name]
    return (
      <Glyph
        ref={ref}
        aria-hidden="true"
        focusable="false"
        size={size}
        className={cn('shrink-0', className)}
        {...(filled ? { fill: 'currentColor', fillOpacity: 0.2 } : {})}
        {...props}
      />
    )
  },
)
Icon.displayName = 'Icon'
