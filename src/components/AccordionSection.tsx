import { useState } from "react";
import type { ReactNode } from "react";
import "../styles/accordion.css";

interface Props {
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
}

export default function AccordionSection({
  title,
  defaultOpen = false,
  children
}: Props) {
  const [open, setOpen] = useState(defaultOpen);

  // id utile pour aria-controls
  const id = `acc-${title.replace(/\s+/g, "-").toLowerCase()}`;

  return (
    <section className="accordion-section">
      <header
        className="accordion-header"
        role="button"
        tabIndex={0}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(o => !o)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen(o => !o);
          }
        }}
      >
        <h3>{title}</h3>
        <span className={`chevron ${open ? "open" : ""}`} aria-hidden>{open ? "˄" : "˅"}</span>
      </header>

      {open && (
        <div id={id} className="accordion-content" role="region" aria-labelledby={id}>
          {children}
        </div>
      )}
    </section>
  );
}
