'use client'
import { useEffect, useState } from "react";

export function StatsFooterSection() {
  const [textColor, setTextColor] = useState("#000000");

  useEffect(() => {
    const getBackground = () => {
      const containerMain = document.querySelector(".container-main");
      if (containerMain) {
        const bg = getComputedStyle(containerMain).backgroundColor;
        if (bg && bg !== "rgba(0, 0, 0, 0)" && bg !== "transparent") {
          return bg;
        }
      }
      return getComputedStyle(document.documentElement)
        .getPropertyValue("--background")
        .trim();
    };

    const parseBrightness = (color: string) => {
      const match = color.match(/\d+/g);
      if (match) {
        const [r, g, b] = match.map(Number);
        return 0.299 * r + 0.587 * g + 0.114 * b;
      }
      const hex = color.replace("#", "");
      if (hex.length === 3 || hex.length === 6) {
        const full = hex.length === 3
          ? hex.split("").map((c) => c + c).join("")
          : hex;
        const r = parseInt(full.slice(0, 2), 16);
        const g = parseInt(full.slice(2, 4), 16);
        const b = parseInt(full.slice(4, 6), 16);
        return 0.299 * r + 0.587 * g + 0.114 * b;
      }
      return 128;
    };

    const bg = getBackground();
    const brightness = parseBrightness(bg);
    setTextColor(brightness > 128 ? "#000000" : "#ff9fc6");
  }, []);

  return (
    <section className="footer pt-16">
      <div className="mx-auto max-w-4xl px-6">
        <p className="mt-3 text-center" style={{ color: textColor }}>
          <a href={"/terms"} className={"hover:underline"}>
            Terms of Service
          </a>
          &nbsp;|&nbsp;
          <a href={"/privacy"} className={"hover:underline"}>
           Privacy Policy
          </a>
          &nbsp;|&nbsp;
          <a href={"mailto:rayaserahill@gmail.com"} className={"hover:underline"}>
            Contact
          </a>
          &nbsp;|&nbsp;&copy; 2026 Raya Serahill
        </p>
      </div>
    </section>
  );
}