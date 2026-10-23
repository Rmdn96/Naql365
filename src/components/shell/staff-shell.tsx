'use client';
import Link from 'next/link';
import {
  ChevronLeft,
  ChevronRight,
  FileText,
  Headphones,
  Landmark,
  LayoutDashboard,
  Menu,
  Package,
  Route,
  ShieldCheck,
  X,
  CircleDashed,
} from 'lucide-react';
import '@/styles/lovable.css';
import '@/styles/lovable-store.css';
import '@/styles/staff-source.css';
import '@/styles/staff-admin.css';
import { Brand } from '@/components/design-system/brand';
import { DesignFoundation } from '@/components/design-system/foundation';
import { usePathname } from 'next/navigation';
import { useRef, useState } from 'react';
import type { Locale } from '@/i18n/config';
import { LocaleLink } from './locale-link';
import { MarketSelector } from './market-selector';
import { ThemeControl } from './theme-control';
import type { PublicCountry } from '@/domain/markets/public-contact';
export type StaffLink = { href: string; label: string; symbol: string };
export function StaffShell({
  locale,
  country,
  organizationName,
  marketName,
  themeMode,
  links,
  logout,
  children,
}: {
  locale: Locale;
  country: PublicCountry;
  organizationName?: string;
  marketName?: string;
  themeMode: 'light' | 'dark' | 'system';
  links: StaffLink[];
  logout: React.ReactNode;
  children: React.ReactNode;
}) {
  const path = usePathname(),
    ar = locale === 'ar';
  const [collapsed, setCollapsed] = useState(false);
  const drawer = useRef<HTMLDialogElement>(null),
    trigger = useRef<HTMLButtonElement>(null);
  const active = links
    .filter(
      (l) =>
        !l.href.includes('#') &&
        (path === l.href || (l.href !== '/' + locale + '/portal' && path.startsWith(l.href + '/'))),
    )
    .sort((a, b) => b.href.length - a.href.length)[0];
  const close = () => {
    drawer.current?.close();
    trigger.current?.focus();
  };
  const icons: Record<string, typeof FileText> = {
    '◈': LayoutDashboard,
    '▤': FileText,
    '⇄': Route,
    '▣': FileText,
    '▦': Package,
    '↗': Route,
    '◇': Route,
    '▥': ShieldCheck,
    '⚙': Landmark,
    '◎': Headphones,
  };
  const nav = (mobile = false) => (
    <nav className="sx-nav" aria-label={ar ? 'وحدات العمل' : 'Workspace modules'}>
      {links.map((l) => {
        const Icon = icons[l.symbol] ?? CircleDashed;
        return (
          <Link
            key={l.href}
            href={l.href}
            className={l.href.includes('#') ? 'staff-nav-child' : undefined}
            aria-current={active?.href === l.href ? 'page' : undefined}
            title={l.label}
            {...(mobile ? { onClick: close } : {})}
          >
            <span aria-hidden="true" className="staff-nav-symbol">
              <Icon size={18} aria-hidden="true" />
            </span>
            <span className="staff-nav-label">{l.label}</span>
          </Link>
        );
      })}
    </nav>
  );
  return (
    <DesignFoundation
      family="staff"
      lang={locale}
      dir={ar ? 'rtl' : 'ltr'}
      className={'lovable cx sx staff-app' + (collapsed ? ' staff-app--collapsed sx-mini' : '')}
    >
      <a className="skip-link" href="#staff-content">
        {ar ? 'انتقل إلى مساحة العمل' : 'Skip to workspace'}
      </a>
      <aside className="staff-sidebar sx-sidebar">
        <Brand
          locale={locale}
          href={'/' + locale + '/portal'}
          className="staff-brand sx-brand"
          size="staff"
          wordmarkClassName="staff-nav-label"
        />
        <p className="staff-nav-label staff-sidebar-caption sx-workspace">
          {ar ? 'مساحة العمل' : 'Workspace'}
        </p>
        {nav()}
        <button
          className="staff-collapse"
          aria-label={collapsed ? (ar ? 'توسيع' : 'Expand') : ar ? 'طي القائمة' : 'Collapse'}
          aria-expanded={!collapsed}
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? (
            <ChevronRight size={18} aria-hidden="true" />
          ) : (
            <ChevronLeft size={18} aria-hidden="true" />
          )}
          <span className={collapsed ? 'sr-only' : undefined}>
            {collapsed ? (ar ? 'توسيع' : 'Expand') : ar ? 'طي القائمة' : 'Collapse'}
          </span>
        </button>
        <Link href={'/' + locale} className="staff-nav-label">
          {ar ? 'الموقع العام' : 'Public website'}
        </Link>
      </aside>
      <div className="staff-app-main sx-work">
        <header className="staff-topbar sx-topbar">
          <button
            ref={trigger}
            className="staff-drawer-trigger button button--secondary"
            aria-haspopup="dialog"
            onClick={() => drawer.current?.showModal()}
          >
            <Menu size={18} aria-hidden="true" />
            <span>{ar ? 'القائمة' : 'Menu'}</span>
          </button>
          <div className="staff-context sx-breadcrumb">
            <span>{ar ? 'مساحة الموظفين' : 'Staff workspace'}</span>
            <strong>{active?.label ?? (ar ? 'تفاصيل العمل' : 'Work details')}</strong>
            {organizationName && marketName && (
              <span className="staff-organization-context">
                {organizationName} · {marketName}
              </span>
            )}
          </div>
          <div className="staff-topbar-actions sx-top-controls">
            <MarketSelector country={country} locale={locale} id="staff-market" />
            <LocaleLink locale={locale} label={ar ? 'English' : 'العربية'} />
            <ThemeControl locale={locale} initialMode={themeMode} />
            <span className="staff-identity">
              {ar ? 'عضوية موظف معتمدة' : 'Verified staff membership'}
            </span>
            {logout}
          </div>
        </header>
        <div className="staff-workspace-content" id="staff-content" tabIndex={-1}>
          <nav className="staff-breadcrumb" aria-label={ar ? 'مسار الصفحة' : 'Breadcrumb'}>
            <Link href={'/' + locale + '/portal'}>{ar ? 'لوحة العمل' : 'Dashboard'}</Link>
            {active?.href !== '/' + locale + '/portal' && (
              <span> / {active?.label ?? (ar ? 'تفاصيل' : 'Details')}</span>
            )}
          </nav>
          {children}
        </div>
      </div>
      <dialog
        ref={drawer}
        className="staff-drawer sx-drawer"
        aria-label={ar ? 'قائمة مساحة العمل' : 'Workspace menu'}
        onCancel={close}
      >
        <div className="staff-drawer-heading">
          <Brand locale={locale} size="mobile" />
          <button className="button button--secondary" onClick={close}>
            <X size={18} aria-hidden="true" />
            {ar ? 'إغلاق' : 'Close'}
          </button>
        </div>
        {nav(true)}
        <Link href={'/' + locale} onClick={close}>
          {ar ? 'الموقع العام' : 'Public website'}
        </Link>
      </dialog>
    </DesignFoundation>
  );
}
