import { createRoot } from "react-dom/client";
import { GraduationCap } from "@phosphor-icons/react";
import { Theme } from "@radix-ui/themes";
import "@radix-ui/themes/styles.css";
import "../src/styles.css";
import { DemoPanel } from "../src/demo-panel";

createRoot(document.getElementById("root")!).render(
  <Theme accentColor="teal" grayColor="slate" radius="medium">
    <main className="content presentation">
      <header className="page-heading">
        <div>
          <div className="brand"><GraduationCap size={24} weight="bold" aria-hidden="true" />CampusDesk</div>
          <h1>Demo bảo mật SQL và MongoDB</h1>
        </div>
      </header>
      <DemoPanel variant="presentation" presentation />
    </main>
  </Theme>
);
