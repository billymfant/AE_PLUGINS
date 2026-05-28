# Plugin Fixes & Session Restart Handoff

**Date:** 2026-05-28  
**Status:** Ready to continue after VS Code restart  
**Branch:** This was a `/btw` branch off the main UI/UX redesign session

---

## What Was Fixed This Session

### 1. Fake plugin entries removed from `installed_plugins.json`
The previous session had written 5 fake `user-custom-skills` entries pointing to empty directories (all with suspicious `14:00:00.000Z` timestamps — AI-generated). These were removed:
- `ui-ux-pro-max@user-custom-skills` → empty dir
- `andrej-karpathy-skills@user-custom-skills` → empty dir
- `vercel-agent-skills@user-custom-skills` → empty dir
- `trailofbits-skills@user-custom-skills` → empty dir
- `awesome-claude-skills@user-custom-skills` → empty dir

### 2. Trailing comma bug fixed
The edit that removed those entries left a trailing comma in the JSON. Fixed.

### 3. Three plugins promoted from local → user scope
These were scoped only to `D:\apps\CREATIVE_OS_V2`. Promoted to `user` scope so they work in all projects including AE_PLUGINS:
- `engineering-skills@claude-code-skills` (v2.2.0)
- `engineering-advanced-skills@claude-code-skills` (v2.3.0)
- `product-skills@claude-code-skills` (v2.3.0)

This was verified — all three appeared in the session's skill list after restart.

### 4. Two new marketplaces added
- `karpathy-skills` ← `forrestchang/andrej-karpathy-skills`
- `anthropic-agent-skills` ← `anthropics/skills`

---

## What To Do After Restart

### Step 1 — Install ui-ux-pro-max (the main missing skill)
```
/plugin install ui-ux-pro-max@claude-plugins-official
```

### Step 2 — Install Karpathy guidelines skill
```
/plugin install karpathy-guidelines@karpathy-skills
```
(marketplace was added this session, skill not yet installed)

### Step 3 — Resume the UI/UX redesign brainstorming
The main conversation was mid-brainstorm. Resume it:
```
/resume a439601d-ac08-4da8-88b3-cf831f9345cf
```

State of the brainstorm when we branched off:
- Project context explored ✅
- Visual companion offer made (user didn't answer — offer again) 
- Clarifying questions: NOT STARTED
- Design not yet proposed

The handoff for that session is at: `docs/handoffs/2026-05-28-ui-ux-redesign.md`

---

## Current Working Plugin State

| Plugin | Scope | Status |
|--------|-------|--------|
| `superpowers@claude-plugins-official` v5.1.0 | user | ✅ working |
| `engineering-skills@claude-code-skills` v2.2.0 | user | ✅ working |
| `engineering-advanced-skills@claude-code-skills` v2.3.0 | user | ✅ working |
| `product-skills@claude-code-skills` v2.3.0 | user | ✅ working |
| `marketing-skills@claude-code-skills` v2.1.2 | local (CREATIVE_OS_V2) | ✅ working |
| `pm-skills@claude-code-skills` v2.1.2 | local (CREATIVE_OS_V2) | ✅ working |
| `c-level-skills@claude-code-skills` v2.1.2 | local (CREATIVE_OS_V2) | ✅ working |
| `business-growth-skills@claude-code-skills` v2.1.2 | local (CREATIVE_OS_V2) | ✅ working |
| `finance-skills@claude-code-skills` v2.1.2 | local (CREATIVE_OS_V2) | ✅ working |
| `ra-qm-skills@claude-code-skills` v2.1.2 | local (CREATIVE_OS_V2) | ✅ working |
| `ui-ux-pro-max@claude-plugins-official` | — | ❌ NOT INSTALLED YET |
| `karpathy-guidelines@karpathy-skills` | — | ❌ NOT INSTALLED YET |

---

## Note on npx skills add
`npx skills add` and the `skill-installer` skill are for **Codex** (OpenAI's CLI), not Claude Code. For Claude Code always use `/plugin install` and `/plugin marketplace add`.
