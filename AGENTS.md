# Legacy Beef Admin — Codex Instructions

## Project
Admin panel for Legacy Land & Cattle, LLC (Twisted Pines Farm).
Live at: admin.legacylandandcattleco.com
Repo: goldycodes87/legacy-beef-admin
Stack: Next.js 15, Tailwind CSS, Supabase, Vercel

## Your Job
You are redesigning the admin panel UI using a professional 
component library. The app is fully functional — do NOT 
change any API routes, data fetching logic, or business logic. 
Only change UI/styling code.

## Rules
1. Never touch app/api/ — all API routes are off limits
2. Never change Supabase queries or data logic
3. Always run npm run build before reporting done
4. Always git add -A && git commit && git push when done
5. Read existing code before writing anything new
6. Keep all existing functionality — no regressions

## Git
Push to main. Vercel auto-deploys from GitHub.
Set remote URL before pushing:
git remote set-url origin https://goldycodes87:GITHUB_TOKEN@github.com/goldycodes87/legacy-beef-admin.git
Replace GITHUB_TOKEN with actual token from api-keys.env

## Design System
Brand colors:
--accent: #E85D24
--accent-on: #ffffff
--accent-soft: rgba(232,93,36,0.12)
--accent-border: rgba(232,93,36,0.20)
--surface-0: #0F0F0F
--surface-1: #1a1a1a
--surface-2: #242424
--surface-3: #2e2e2e
--border-subtle: rgba(255,255,255,0.05)
--border: rgba(255,255,255,0.08)
--border-strong: rgba(255,255,255,0.14)
--text: #F5F5F5
--text-secondary: #9CA3AF
--text-muted: #6B7280
--success-fg: #10B981
--success-bg: rgba(16,185,129,0.12)
--success-border: rgba(16,185,129,0.20)
--warning-fg: #F59E0B
--warning-bg: rgba(245,158,11,0.12)
--warning-border: rgba(245,158,11,0.20)
--danger-fg: #EF4444
--danger-bg: rgba(239,68,68,0.12)
--danger-border: rgba(239,68,68,0.20)
--info-fg: #3B82F6
--info-bg: rgba(59,130,246,0.12)
--info-border: rgba(59,130,246,0.20)
--gold-fg: #C4A46B
--gold-bg: rgba(196,164,107,0.12)
--gold-border: rgba(196,164,107,0.20)
--neutral-fg: #6B7280
--neutral-bg: rgba(107,114,128,0.12)
--neutral-border: rgba(107,114,128,0.20)
--radius-sm: 4px
--radius-md: 6px
--radius-lg: 8px
--radius-xl: 12px
--sidebar-w: 15rem

## Deploy
Vercel auto-deploys on push to main.
