# Lessons Learned

> Append-only register of recurring rules and patterns. Re-read at start by /10x-frame, /10x-research, /10x-plan, /10x-plan-review, /10x-implement, /10x-impl-review.

## Close roadmap issues explicitly with "Closes #N"

- **Context**: Every roadmap change that has a GitHub issue (S-xx, F-xx), plus any open-question issues (Q-x) it resolves.
- **Problem**: Issue S-01 (#3) stayed open after deploy and archive, because neither GitHub nor /10x-archive closes issues automatically.
- **Rule**: Always put "Closes #N" for the change's issue and any Q-x it resolves in the PR description or the commit that lands on master. At archive time, check the issues are closed and close them manually if not.
- **Applies to**: plan, implement
