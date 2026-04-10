 # Bantayog Alert - Master Implementation Plan

  ## Overview
  Building a disaster reporting platform for Camarines Norte, Philippines.

  ## Phase Order
  Follow the phases defined in docs/AI-IMPLEMENTATION-GUIDE.md

  ## Specification Documents
  All implementation MUST follow these specs:
  - docs/citizen-role-spec.md
  - docs/responder-role-spec.md
  - docs/municipal-admin-role-spec.md
  - docs/provincial-superadmin-role-spec.md
  - docs/communication-architecture.md

  ## Critical Rules
  1. NO chat features (use Facebook Messenger/phone)
  2. MFA MANDATORY for Provincial Superadmins
  3. 6-month data retention (auto-archive)
  4. Map-centric for Municipal Admins (desktop)
  5. Mobile-first for Citizens and Responders

  ## Success Criteria
  Each phase must pass ALL tests before proceeding to next phase.

  2. Use superpowers' Plan Mode

  When starting each phase, use the writing-plans skill:

  User: "I want to start Phase 2: Citizen Features"

  superpowers will:
  1. Break down the phase into tasks
  2. Create review checkpoints
  3. Assign work to subagents
  4. Enforce TDD
  5. Require code review before completion

  3. Reference Specs in Prompts

  When superpowers delegates to subagents, include:

  **CONTEXT:**
  Building Bantayog Alert, a disaster reporting platform.
  Read: docs/citizen-role-spec.md (section: Report Submission)
  Read: docs/communication-architecture.md (NO chat features)

  **REQUIREMENTS:**
  [Copy specific requirements from spec]

  **TESTS:**
  Write tests first (TDD)

---
  🚀 Practical Workflow

  Step 1: Start a Phase

  You: "Start Phase 0: Project Setup using superpowers"

  superpowers using-superpowers skill activates
  → Creates implementation plan
  → Breaks into tasks
  → Shows you the plan for approval

  Step 2: Execute the Plan

  superpowers executing-plans skill activates
  → Delegates tasks to subagents
  → Each subagent gets spec context
  → Enforces TDD
  → Requires code review
  → Shows progress

  Step 3: Review Checkpoint

  superpowers verification-before-completion skill activates
  → Compares work to spec
  → Lists requirements: ✅ ❌ ⚠️ 
  → Can't proceed until all ✅

  Step 4: Complete Phase

  superpowers finishing-a-development-branch skill activates
  → All tests pass
  → All requirements met
  → Merge to main
  → Start next phase