---
starter_id: 10x-astro-starter
package_manager: npm
project_name: pasuje-mi
hints:
  language_family: js
  team_size: solo
  deployment_target: cloudflare-pages
  ci_provider: github-actions
  ci_default_flow: auto-deploy-on-merge
  bootstrapper_confidence: first-class
  path_taken: standard
  quality_override: false
  self_check_answers: null
  has_auth: true
  has_payments: false
  has_realtime: false
  has_ai: false
  has_background_jobs: false
---

## Why this stack

PasujeMi is a web app built solo, after hours, with a roughly three-week MVP and a hard deadline, by a frontend developer working in TypeScript. The standard path was taken: 10x Astro Starter is the recommended default for a web app in the JS family and clears all four agent-friendly gates (typed, convention-based, popular in training data, well documented). Its bundled auth, PostgreSQL database and storage cover the MVP's accounts and the author/admin edit rights without an extra integration, and the React-based UI fits the builder's existing experience. Auth is the only feature flag set; photo-based recipe autofill (the AI feature) is out of MVP scope per the PRD non-goals, and there are no payments, realtime or background jobs. Access rules on the data layer must be configured early, because pantry staples and exclusions are private and shared recipes may be changed only by their author or an admin. Deployment uses the starter's default Cloudflare Pages target, with CI on GitHub Actions and auto-deploy on merge to main. Bootstrapper confidence is first-class, so expect mostly smooth scaffolding with occasional manual steps.
