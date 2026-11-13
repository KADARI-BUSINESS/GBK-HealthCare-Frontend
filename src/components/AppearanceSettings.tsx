import { ACCENT_THEMES, type AccentThemeId } from "../theme";
import "./AppearanceSettings.css";

type AppearanceSettingsProps = {
  selectedTheme: AccentThemeId;
  onSelectTheme: (theme: AccentThemeId) => void;
  onReset: () => void;
};

export default function AppearanceSettings({ selectedTheme, onSelectTheme, onReset }: AppearanceSettingsProps) {
  return (
    <section className="appearance-settings" aria-labelledby="appearance-title">
      <header className="appearance-heading">
        <span className="appearance-kicker">ACCOUNT SETTINGS</span>
        <h2 id="appearance-title">Appearance</h2>
        <p>Choose an accent colour for your GBK HealthCare workspace. Your selection is saved in this browser.</p>
      </header>
      <section className="appearance-theme-section" aria-labelledby="theme-choice-heading">
        <div className="appearance-theme-heading">
          <div><h3 id="theme-choice-heading">Colour Theme</h3><p>White surfaces remain consistent across all themes.</p></div>
          <button type="button" className="appearance-reset" onClick={onReset}>Reset to Royal Violet</button>
        </div>
        <div className="appearance-theme-grid" role="group" aria-label="Choose an accent colour theme">
          {ACCENT_THEMES.map((theme) => {
            const selected = selectedTheme === theme.id;
            return <button type="button" key={theme.id} className={`appearance-theme-option${selected ? " is-selected" : ""}`} aria-pressed={selected} onClick={() => onSelectTheme(theme.id)}>
              <span className="appearance-theme-swatch" style={{ backgroundColor: theme.primary, color: theme.text }} aria-hidden="true">Aa</span>
              <span className="appearance-theme-name">{theme.name}</span>
              <span className="appearance-theme-check" aria-hidden="true">{selected ? "✓" : ""}</span>
            </button>;
          })}
        </div>
      </section>
      <p className="appearance-storage-note">Theme preferences are stored locally in this browser and are not synchronized across devices.</p>
    </section>
  );
}
