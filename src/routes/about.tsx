import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/about')({
  component: About,
})

function About() {
  return (
    <main className="page-wrap px-4 py-12">
      <section className="island-shell pixel-frame rounded-none p-6 sm:p-8">
        <p className="island-kicker mb-3">About The Console</p>
        <h1 className="display-title mb-6 text-3xl leading-[1.5] text-[var(--text-main)] sm:text-5xl">
          Built to turn rough ideas into cleaner prompts fast.
        </h1>
        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <p className="m-0 max-w-3xl text-base leading-8 text-[var(--text-soft)]">
            Next Level Prompts is a browser-based prompt workshop for coding agents.
            You drop in a rough goal, choose the build mode, layer in keywords and
            milestones, and the app composes a sharper brief with structure,
            constraints, and implementation hints.
          </p>
          <div className="feature-card rounded-none p-5 text-sm leading-7 text-[var(--text-soft)]">
            <p className="island-kicker mt-0">Why this look</p>
            <p className="m-0">
              The rebrand leans into CRT glow, pixel typography, scanlines, and
              arcade framing so the product feels memorable instead of template-driven.
            </p>
          </div>
        </div>
      </section>
    </main>
  )
}
