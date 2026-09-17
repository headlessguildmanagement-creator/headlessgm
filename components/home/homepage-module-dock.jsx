"use client";

import { MagneticDock } from "../ui/magnetic-dock";

function Glyph({ children }) {
  return <span className="module-glyph" aria-hidden="true">{children}</span>;
}

export function HomepageModuleDock() {
  const jump = (target) => () => {
    document.querySelector(target)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  const items = [
    {
      id: "members",
      label: "Members",
      icon: <Glyph>01</Glyph>,
      onClick: jump("#features"),
    },
    {
      id: "events",
      label: "Events",
      icon: <Glyph>02</Glyph>,
      onClick: jump("#system"),
    },
    {
      id: "attendance",
      label: "Attendance",
      icon: <Glyph>03</Glyph>,
      onClick: jump("#system"),
    },
    {
      id: "lineups",
      label: "Lineups",
      icon: <Glyph>04</Glyph>,
      onClick: jump("#system"),
    },
    {
      id: "rewards",
      label: "Rewards",
      icon: <Glyph>05</Glyph>,
      onClick: jump("#customization"),
    },
    {
      id: "config",
      label: "Configuration",
      icon: <Glyph>06</Glyph>,
      onClick: jump("#customization"),
      isActive: true,
    },
  ];

  return (
    <div className="module-dock-wrap">
      <p>Connected modules</p>
      <MagneticDock items={items} />
      <span>Move across the system</span>
    </div>
  );
}
