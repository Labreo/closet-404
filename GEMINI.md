# RULES.md (read before every task)

Project: Closet 404, a 3D archive of dead websites. Next.js App Router, TypeScript strict, R3F, Tailwind.

HARD RULES
1. Touch ONLY the files named in the current task. If another file needs changing, STOP and ask.
2. No new dependencies. Never use --force or --legacy-peer-deps. Never change package versions.
3. NEVER INVENT DATA. Nothing in data/ is hand-written by you. Only scripts write it, from real fetches. No lorem ipsum, no sample sites, no hardcoded fake responses, no TODO, no stubs, no "implement later". If something cannot be done, output "BLOCKED: <reason>" and stop.
4. If you are not 100% sure of a library API, open the installed package's .d.ts or README in node_modules and quote the exact signature before using it. Do not rely on memory for three, R3F, drei, postprocessing, maath, cheerio.
5. After every task run: npx tsc --noEmit, npm run lint, npm run build, plus the task's acceptance command. Paste the REAL output. Never say "should work" or "done" without pasted output.
6. No `any`, no @ts-ignore, no eslint-disable. Fix root causes.
7. Do not refactor, rename, or reformat code that already passes. Smallest diff that meets the task.
8. Three.js code only in client components loaded with next/dynamic and ssr:false. Never call setState inside useFrame. Never create textures or geometries inside render or useFrame; create once and cache.
9. Secrets come from env only. Never log or commit them.
10. Everything the AI generates (eulogy, persona, tags) must be labeled in the UI as AI-generated. Everything scraped must show its source URL.
11. End every task with: files changed, commands run and results, known gaps. Then STOP and wait. Do not start the next task.

DESIGN TOKENS
bg #0c0b0e, text #e9e4d8, muted #8a8578, marigold #ff9e00, hairline rgba(255,255,255,0.12)
Fonts via next/font/google: Instrument Serif (display), Space Grotesk (labels), JetBrains Mono (numbers, timestamps, hotkeys)
HUD pills: backdrop-filter blur(16px), background rgba(18,17,20,0.78), 1px hairline border, 999px radius
Motion: maath/easing damp, damp3, dampE only. No linear lerp, no instant jumps.

