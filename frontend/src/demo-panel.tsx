import { useTranslation } from "react-i18next";
import { scenarios } from "./demo-scenarios";

export function DemoPanel({ variant, presentation: _presentation }: { variant: string; presentation?: boolean }) {
  const { t } = useTranslation();
  const engine = variant.startsWith("sql") ? "MySQL" : variant.startsWith("mongo") ? "MongoDB" : "MySQL / MongoDB";
  return <section className="panel lab-overview demo-panel" aria-labelledby="manual-demo-title">
    <h2 id="manual-demo-title">{t("demo.manualTitle")}</h2>
    <p>{t("demo.manualDescription", { engine })}</p>
    <ol>
      <li>{t("demo.manualStepOne")}</li>
      <li>{t("demo.manualStepTwo")}</li>
      <li>{t("demo.manualStepThree")}</li>
      <li>{t("demo.manualStepFour")}</li>
    </ol>
    <p className="muted">{t("demo.manualScope")}</p>
    <details>
      <summary>{t("demo.scenarioList")}</summary>
      <ol>
        {scenarios.map(item => <li key={item.id}>
          <strong>{t(`demo.scenarios.${item.id}.title`, { defaultValue: item.title })}</strong>
          <p>{t(`demo.scenarios.${item.id}.request`, { defaultValue: item.request })}</p>
          <p className="muted">{t(`demo.scenarios.${item.id}.defense`, { defaultValue: item.defense })}</p>
        </li>)}
      </ol>
    </details>
  </section>;
}
