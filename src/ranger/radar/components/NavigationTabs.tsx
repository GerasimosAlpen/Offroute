import {
  Map,
  ClipboardList,
  Sparkle,
  Sparkles,
  LayoutGrid,
  Settings,
} from "lucide-preact";
import { NavItem } from "./NavItem";
import { ConnectionStatus } from "./ConnectionStatus";

const NAV_ITEMS = [
  { href: "/ranger/radar/map", label: "Tactical Map", icon: Map },
  { href: "/ranger/radar/logs", label: "Squad Logs", icon: ClipboardList },
  { href: "/ranger/radar/incident", label: "Lapor Incident", icon: Sparkle },
  { href: "/ranger/radar/comm", label: "Comm Center", icon: Sparkles },
  { href: "/ranger/radar/status", label: "Sector Status", icon: LayoutGrid },
];

const FOOTER_ITEMS = [
  { href: "/ranger/radar/settings", label: "Settings", icon: Settings },
];

export function NavigationTabs({ collapsed }: { collapsed: boolean }) {
  return (
    <nav className="flex-1 min-h-0 overflow-y-auto overflow-x-visible py-4 w-full">
      <ul className="flex flex-col items-start w-full">
        {NAV_ITEMS.map((item) => (
          <li key={item.href} className="w-full">
            <NavItem {...item} collapsed={collapsed} />
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function FooterTabs({ collapsed }: { collapsed: boolean }) {
  return (
    <div className="flex flex-col items-start w-full border-t-2 border-[#444] pt-[2px]">
      <ul className="flex flex-col items-start w-full">
        {FOOTER_ITEMS.map((item) => (
          <li key={item.href} className="w-full">
            <NavItem {...item} collapsed={collapsed} />
          </li>
        ))}
      </ul>
      <ConnectionStatus collapsed={collapsed} />
    </div>
  );
}
