import { createContext, useCallback, useContext, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Settings2, type LucideIcon } from "lucide-react";

interface SectionEntry {
  id: string;
  tab: string;
  title: string;
  Icon: LucideIcon;
  element: HTMLElement;
}

interface SectionsContext {
  activeTab: string;
  sections: SectionEntry[];
  register: (entry: SectionEntry) => () => void;
}

const Sections = createContext<SectionsContext | null>(null);
const SectionTab = createContext("");

export function SettingsSections({ activeTab, children }: { activeTab: string; children: ReactNode }) {
  const [sections, setSections] = useState<SectionEntry[]>([]);
  const register = useCallback((entry: SectionEntry) => {
    setSections((current) => [...current, entry].sort((a, b) =>
      a.element.compareDocumentPosition(b.element) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
    return () => setSections((current) => current.filter((section) => section.id !== entry.id));
  }, []);
  return <Sections.Provider value={{ activeTab, sections, register }}>
    {children}
  </Sections.Provider>;
}

export function SettingsSectionTab({ tab, children }: { tab: string; children: ReactNode }) {
  return <SectionTab.Provider value={tab}>{children}</SectionTab.Provider>;
}

export function SettingsSection({ title, icon: Icon = Settings2, children, className = "" }: { title: string; icon?: LucideIcon; children: ReactNode; className?: string }) {
  const context = useContext(Sections);
  const tab = useContext(SectionTab);
  const id = useId();
  const ref = useRef<HTMLElement>(null);
  const register = context?.register;
  useLayoutEffect(() => {
    if (register && ref.current) return register({ id, tab, title, Icon, element: ref.current });
  }, [register, id, tab, title, Icon]);
  return <section ref={ref} id={`settings-section-${id}`} className={`settings-section ${className}`} aria-labelledby={`settings-section-title-${id}`}>
    <h2 id={`settings-section-title-${id}`} className="settings-section-title" tabIndex={-1}>
      <Icon size={15} aria-hidden="true" /><span>{title}</span>
    </h2>
    <div className="settings-section-body">{children}</div>
  </section>;
}

export function SettingsSectionLinks({ tab }: { tab: string }) {
  const context = useContext(Sections);
  if (!context || context.activeTab !== tab) return null;
  return <div className="settings-section-links">
    {context.sections.filter((section) => section.tab === tab).map((section) =>
      <button type="button" key={section.id} aria-controls={`settings-section-${section.id}`}
        onClick={() => {
          requestAnimationFrame(() => {
            section.element.scrollIntoView({ block: "start" });
            section.element.querySelector<HTMLElement>(".settings-section-title")?.focus({ preventScroll: true });
          });
        }}><section.Icon size={13} aria-hidden="true" /><span>{section.title}</span></button>)}
  </div>;
}
